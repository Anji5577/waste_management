import { GEMINI } from '@/config';
import { AppError, WASTE_CLASSES, type WasteClass } from '@/types';
import { WASTE_PROMPT, WASTE_RESPONSE_SCHEMA } from './schema';

export interface GeminiItem {
  readonly name: string;
  readonly material: WasteClass;
  readonly confidence: number;
  readonly soiled: 'yes' | 'no' | 'unknown';
  /** [ymin, xmin, ymax, xmax], normalised 0-1000. */
  readonly box_2d: readonly number[];
}

export interface GeminiResult {
  readonly items: readonly GeminiItem[];
  readonly scene: 'single-item' | 'few-items' | 'pile-or-scene';
  readonly usage: { inputTokens: number; outputTokens: number } | null;
  /** Which model actually answered — may be a fallback, so it is surfaced. */
  readonly model: string;
}

/** Shape of the /v1beta/interactions response we actually depend on. */
interface InteractionsResponse {
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  usage?: { total_input_tokens?: number; total_output_tokens?: number };
  error?: { message?: string; status?: string };
}

/**
 * Pull the model's text out of the response.
 *
 * The reply is a list of steps and only some carry text — reasoning steps can
 * precede the answer — so this scans rather than indexing `steps[0]`, which
 * would break the moment the model thinks before answering.
 */
function extractText(body: InteractionsResponse): string | null {
  for (const step of body.steps ?? []) {
    for (const part of step.content ?? []) {
      if (typeof part.text === 'string' && part.text.trim() !== '') return part.text;
    }
  }
  return null;
}

/**
 * Transient failures worth retrying against another model.
 *
 * 429 and 5xx mean "not now"; 401/403 mean "not ever with this key", and
 * retrying those against every model in the list would just burn time and make
 * the real problem harder to see.
 */
export function isTransient(status: number): boolean {
  return status === 429 || status >= 500;
}

function httpError(status: number, message: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError('API_KEY_INVALID', 'The Gemini API key was rejected.', {
      hint: 'Check VITE_GEMINI_API_KEY in your .env file, then restart the dev server.',
      detail: `HTTP ${status}: ${message}`,
    });
  }
  if (status === 429) {
    return new AppError('API_RATE_LIMITED', 'Gemini is rate-limiting this key.', {
      hint: 'Wait a moment and try again, or check your quota in Google AI Studio.',
      detail: `HTTP ${status}: ${message}`,
    });
  }
  if (status >= 500) {
    return new AppError('API_UNAVAILABLE', 'Gemini is temporarily unavailable.', {
      hint: 'This is on Google’s side. Try again in a moment.',
      detail: `HTTP ${status}: ${message}`,
    });
  }
  return new AppError('INFERENCE_FAILED', 'Gemini could not analyse this image.', {
    hint: 'Try again, or use a different photo.',
    detail: `HTTP ${status}: ${message}`,
  });
}

function isWasteClass(value: string): value is WasteClass {
  return (WASTE_CLASSES as readonly string[]).includes(value);
}

/**
 * Validate what came back.
 *
 * The schema is a request, not a guarantee — the response still arrives as
 * untrusted JSON over the network. Anything malformed is dropped rather than
 * carried forward, because a bad `material` would land in the rules table and a
 * bad box would be drawn over the user's photo.
 */
function parseResult(
  text: string,
  usage: GeminiResult['usage'],
  model: string,
): GeminiResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    throw new AppError('INFERENCE_FAILED', 'Gemini returned a malformed response.', {
      hint: 'Try again.',
      detail: text.slice(0, 300),
      cause,
    });
  }

  const obj = raw as { items?: unknown; scene?: unknown };
  const items: GeminiItem[] = [];
  for (const entry of Array.isArray(obj.items) ? obj.items : []) {
    const it = entry as Partial<GeminiItem> & { box_2d?: unknown };
    if (typeof it.material !== 'string' || !isWasteClass(it.material)) continue;
    if (typeof it.confidence !== 'number' || !Number.isFinite(it.confidence)) continue;
    const box = Array.isArray(it.box_2d) ? it.box_2d.map(Number) : [];
    items.push({
      name: typeof it.name === 'string' && it.name.trim() ? it.name.trim() : it.material,
      material: it.material,
      confidence: Math.min(1, Math.max(0, it.confidence)),
      soiled: it.soiled === 'yes' || it.soiled === 'no' ? it.soiled : 'unknown',
      box_2d: box.length === 4 && box.every(Number.isFinite) ? box : [],
    });
  }

  const scene =
    obj.scene === 'pile-or-scene' || obj.scene === 'few-items' || obj.scene === 'single-item'
      ? obj.scene
      : 'few-items';

  return { items, scene, usage, model };
}

/**
 * Send one image to Gemini and return the parsed items.
 *
 * `imageBase64` must be raw base64 with no `data:` prefix.
 */
export async function analyzeImage(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  signal?: AbortSignal,
  model: string = GEMINI.MODEL,
): Promise<GeminiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI.REQUEST_TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${GEMINI.ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: [
          { type: 'text', text: WASTE_PROMPT },
          { type: 'image', data: imageBase64, mime_type: mimeType },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: WASTE_RESPONSE_SCHEMA,
        },
      }),
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    const timedOut = controller.signal.aborted;
    throw new AppError(
      timedOut ? 'API_TIMEOUT' : 'API_UNREACHABLE',
      timedOut ? 'Gemini took too long to respond.' : 'Could not reach Gemini.',
      {
        hint: timedOut
          ? 'Try again, or use a smaller photo.'
          : 'Check your internet connection and try again.',
        cause,
      },
    );
  } finally {
    clearTimeout(timer);
  }

  const body = (await response.json().catch(() => ({}))) as InteractionsResponse;
  if (!response.ok) {
    throw httpError(response.status, body.error?.message ?? response.statusText);
  }

  const text = extractText(body);
  if (text === null) {
    throw new AppError('INFERENCE_FAILED', 'Gemini returned an empty response.', {
      hint: 'Try again, or use a different photo.',
      detail: JSON.stringify(body).slice(0, 300),
    });
  }

  return parseResult(
    text,
    {
      inputTokens: body.usage?.total_input_tokens ?? 0,
      outputTokens: body.usage?.total_output_tokens ?? 0,
    },
    model,
  );
}

/**
 * Try the primary model, then the fallbacks, on transient failure only.
 *
 * This is not defensive padding. Measured live: `gemini-3.7-flash` and
 * `gemini-flash-latest` both returned 500 "experiencing high demand" while
 * other models answered normally seconds later. Capacity for a single model
 * comes and goes, and without this the whole app is down whenever it does.
 *
 * The last error is rethrown if every model fails, so the user sees a real
 * reason rather than a generic one.
 */
export async function analyzeImageWithFallback(
  imageBase64: string,
  mimeType: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<GeminiResult> {
  const candidates = [GEMINI.MODEL, ...GEMINI.FALLBACK_MODELS];
  let lastError: unknown;

  for (const model of candidates) {
    try {
      return await analyzeImage(imageBase64, mimeType, apiKey, signal, model);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;
      const code = error instanceof AppError ? error.code : null;
      const retryable =
        code === 'API_UNAVAILABLE' || code === 'API_RATE_LIMITED' || code === 'API_TIMEOUT';
      if (!retryable) throw error;
    }
  }
  throw lastError;
}
