/**
 * Server-side handlers, deliberately framework-agnostic.
 *
 * The whole point of this file is that the Gemini and ImgBB keys never reach
 * the browser. `VITE_`-prefixed variables are inlined into the JavaScript
 * bundle at build time, so a client-side key is public the moment the site is;
 * these are read from the plain environment and stay on the server.
 *
 * Kept adapter-free so the Vercel function and the Vite dev middleware run the
 * identical code — a proxy that only exists in production is one that gets
 * debugged in production.
 */

/** Just the shape we read, so the function bundle needs no @types/node. */
export type Env = Record<string, string | undefined>;

export interface HandlerResult {
  status: number;
  body: unknown;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';

/**
 * 412, deliberately not 503.
 *
 * Gemini returns 503 when a model is overloaded, and the client retries that
 * against a fallback model. If a missing key also answered 503, a
 * misconfiguration would silently burn through every model in the fallback list
 * before failing — and the error the user saw would blame capacity rather than
 * configuration.
 */
function missingKey(name: string): HandlerResult {
  return {
    status: 412,
    body: {
      error: {
        message: `${name} is not set on the server.`,
        hint: `Add ${name} as an environment variable (no VITE_ prefix) and redeploy.`,
      },
    },
  };
}

/** What the browser is allowed to know about server configuration. */
export function handleConfig(env: Env): HandlerResult {
  return {
    status: 200,
    body: {
      gemini: Boolean(env.GEMINI_API_KEY?.trim()),
      imgbb: Boolean(env.IMGBB_API_KEY?.trim()),
    },
  };
}

/**
 * Forward one classification request to Gemini.
 *
 * The model and response schema come from the client so the prompt stays in one
 * place, but the key is attached here. Nothing else is added or rewritten — the
 * proxy is a credential boundary, not a second opinion about the request.
 */
export async function handleGemini(
  payload: unknown,
  env: Env,
): Promise<HandlerResult> {
  const key = env.GEMINI_API_KEY?.trim();
  if (!key) return missingKey('GEMINI_API_KEY');

  const body = payload as { model?: unknown; input?: unknown } | null;
  if (!body || typeof body.model !== 'string' || !Array.isArray(body.input)) {
    return { status: 400, body: { error: { message: 'Expected { model, input, response_format }.' } } };
  }

  try {
    const upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    // Pass the status through untouched: the client already maps 429/5xx to a
    // retry against another model, and rewriting them here would break that.
    return { status: upstream.status, body: await upstream.json().catch(() => ({})) };
  } catch (cause) {
    return {
      status: 502,
      body: { error: { message: 'Could not reach Gemini.', detail: String(cause) } },
    };
  }
}

/** Forward one image upload to ImgBB, attaching the key server-side. */
export async function handleImgbb(
  payload: unknown,
  env: Env,
): Promise<HandlerResult> {
  const key = env.IMGBB_API_KEY?.trim();
  if (!key) return missingKey('IMGBB_API_KEY');

  const body = payload as { image?: unknown; name?: unknown; expiration?: unknown } | null;
  if (!body || typeof body.image !== 'string' || body.image.length === 0) {
    return { status: 400, body: { error: { message: 'Expected { image, name }.' } } };
  }

  const form = new FormData();
  form.set('key', key);
  form.set('image', body.image);
  if (typeof body.name === 'string' && body.name) form.set('name', body.name);
  if (typeof body.expiration === 'number') form.set('expiration', String(body.expiration));

  try {
    const upstream = await fetch(IMGBB_ENDPOINT, { method: 'POST', body: form });
    return { status: upstream.status, body: await upstream.json().catch(() => ({})) };
  } catch (cause) {
    return {
      status: 502,
      body: { error: { message: 'Could not reach the image host.', detail: String(cause) } },
    };
  }
}
