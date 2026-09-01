// @ts-check
/**
 * Server-side handlers, deliberately framework-agnostic and plain JavaScript.
 *
 * The whole point of this file is that the Gemini and ImgBB keys never reach the
 * browser. `VITE_`-prefixed variables are inlined into the JavaScript bundle at
 * build time, so a client-side key is public the moment the site is; these are
 * read from the process environment and stay on the server.
 *
 * Plain `.js` rather than `.ts` on purpose. A TypeScript function has to be
 * compiled by the platform before it can be routed, and when that step does not
 * happen the symptom is an opaque 404 with nothing in the build log to explain
 * it. ESM JavaScript is the least ambiguous thing a Node runtime can consume.
 * Types are kept via JSDoc and still checked by `tsc`.
 */

/** @typedef {Record<string, string | undefined>} Env */
/** @typedef {{ status: number, body: unknown }} HandlerResult */

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
 *
 * @param {string} name
 * @returns {HandlerResult}
 */
function missingKey(name) {
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

/**
 * What the browser is allowed to know about server configuration.
 * @param {Env} env
 * @returns {HandlerResult}
 */
export function handleConfig(env) {
  return {
    status: 200,
    body: {
      gemini: Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim()),
      imgbb: Boolean(env.IMGBB_API_KEY && env.IMGBB_API_KEY.trim()),
    },
  };
}

/**
 * Forward one classification request to Gemini.
 *
 * The model and response schema come from the client so the prompt stays in one
 * place; the key is attached here. Nothing else is added or rewritten — the
 * proxy is a credential boundary, not a second opinion about the request.
 *
 * @param {unknown} payload
 * @param {Env} env
 * @returns {Promise<HandlerResult>}
 */
export async function handleGemini(payload, env) {
  const key = env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim();
  if (!key) return missingKey('GEMINI_API_KEY');

  const body = /** @type {{ model?: unknown, input?: unknown } | null} */ (payload);
  if (!body || typeof body.model !== 'string' || !Array.isArray(body.input)) {
    return {
      status: 400,
      body: { error: { message: 'Expected { model, input, response_format }.' } },
    };
  }

  try {
    const upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
    });
    // Pass the status through untouched: the client maps 429/5xx to a retry
    // against another model, and rewriting them here would break that.
    return { status: upstream.status, body: await upstream.json().catch(() => ({})) };
  } catch (cause) {
    return {
      status: 502,
      body: { error: { message: 'Could not reach Gemini.', detail: String(cause) } },
    };
  }
}

/**
 * Forward one image upload to ImgBB, attaching the key server-side.
 * @param {unknown} payload
 * @param {Env} env
 * @returns {Promise<HandlerResult>}
 */
export async function handleImgbb(payload, env) {
  const key = env.IMGBB_API_KEY && env.IMGBB_API_KEY.trim();
  if (!key) return missingKey('IMGBB_API_KEY');

  const body = /** @type {{ image?: unknown, name?: unknown, expiration?: unknown } | null} */ (
    payload
  );
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
