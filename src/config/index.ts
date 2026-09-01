/**
 * Single source of truth for every tunable in the system.
 *
 * Nothing else in the codebase should hard-code a threshold, a model name, or a
 * size limit. If you are tempted to write a number in `src/ai/**`, put it here.
 */

export const CONFIDENCE = {
  /**
   * Thresholds applied to the confidence Gemini reports for each item.
   *
   * Treat this number with suspicion. It is the model's *self-report*, not a
   * calibrated probability derived from a distribution — nothing forces it to
   * mean the same thing twice, and language models are known to be
   * overconfident when they self-assess. It is used as a coarse ordering
   * signal, the UI labels it as self-reported, and no claim is made that "0.9"
   * corresponds to being right nine times in ten.
   */
  /** confidence >= HIGH -> 'high' band */
  HIGH: 0.85,
  /** confidence >= MEDIUM -> 'medium'; below this the result becomes UNCERTAIN */
  MEDIUM: 0.7,
} as const;

export const DETECTION = {
  /** Items Gemini reports below this confidence are dropped before display. */
  MIN_ITEM_CONFIDENCE: 0.2,
  /** Hard cap on items rendered, to keep the result readable. */
  MAX_OBJECTS: 12,
  /**
   * Boxes smaller than this fraction of the image are flagged — a tiny box is
   * usually the model pointing at something it could not really resolve.
   */
  MIN_AREA_FRACTION: 0.002,
} as const;

export const IMAGE = {
  ACCEPTED_MIME: ['image/jpeg', 'image/png', 'image/webp'] as const,
  ACCEPTED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  MAX_FILE_BYTES: 20 * 1024 * 1024,
  MIN_DIMENSION: 32,
  /** Long edge the source is downscaled to before inference. */
  MAX_INFERENCE_EDGE: 1024,
} as const;

export const GEMINI = {
  /**
   * Our own serverless proxy, not Google directly.
   *
   * The API key is attached server-side in api/_handlers.ts. A key shipped to
   * the browser is public the moment the site is — Vite inlines every VITE_
   * variable into the bundle — so the browser never sees it and never talks to
   * Google. The request body is still the Interactions shape, forwarded as-is.
   */
  ENDPOINT: '/api/gemini',

  /**
   * Primary model.
   *
   * Measured against this project's own request shape on a real photograph
   * (September 2026, three consecutive runs each):
   *
   *   gemini-3.5-flash        200, 6.0-8.2 s, correct   <- chosen
   *   gemini-3-flash-preview  200, 27 s,      correct
   *   gemini-3.6-flash        200, 50 s,      correct
   *   gemini-2.5-flash        200 but a non-JSON body
   *   gemini-3.7-flash        500 "experiencing high demand"
   *   gemini-flash-latest     500 "experiencing high demand"
   *
   * Newer is not better here: 3.7 was unavailable and 3.6 took long enough to
   * risk tripping the request timeout. 3.5-flash was both the fastest and the
   * most reliable of the models that actually answered.
   */
  MODEL: 'gemini-3.5-flash',

  /**
   * Tried in order when the primary is overloaded or rate-limited.
   *
   * Ordered by measured latency, because a fallback that times out is not a
   * fallback. Only transient failures (429/500/503) trigger this — a rejected
   * key fails immediately rather than being retried against every model in the
   * list.
   */
  FALLBACK_MODELS: ['gemini-3-flash-preview', 'gemini-3.6-flash'] as readonly string[],

  /**
   * Per-request timeout.
   *
   * Kept just under the 60s ceiling declared for the serverless function in
   * vercel.json, so the client aborts first with an error it can explain rather
   * than the platform killing the invocation and returning an opaque 504.
   *
   * Each fallback attempt is a separate invocation, so the chain is not bounded
   * by this — only each individual call is.
   */
  REQUEST_TIMEOUT_MS: 55_000,

  /**
   * Two boxes overlapping by more than this are treated as the same object.
   *
   * A guard, not a fix for a confirmed bug — be honest about which. An early
   * probe appeared to show one banana peel reported twice, but inspecting the
   * boxes showed IoU 0.26: they were two genuinely different peels, correctly
   * separated. No true duplicate has been observed.
   *
   * The threshold is set high (0.6) precisely so it stays out of the way.
   * Distinct-but-adjacent items in the fixtures measure 0.00-0.32, so nothing
   * real is at risk of being merged, while an actual repeat — a known failure
   * mode when a language model enumerates objects — would still be caught.
   */
  DEDUP_IOU: 0.6,

  /**
   * Long edge the photo is downscaled to before upload.
   *
   * Every pixel here is billed and travels over the user's connection, and
   * 1024 px is comfortably enough to identify household objects.
   */
  MAX_UPLOAD_EDGE: 1024,
  JPEG_QUALITY: 0.85,
} as const;

export const STORAGE = {
  /**
   * Our own serverless proxy, not ImgBB directly — the key stays server-side.
   *
   * IMPORTANT, and unchanged by the proxy: uploads are PUBLIC. Every returned
   * URL is viewable by anyone who has it. Photographs of a street may contain
   * people, faces and number plates.
   */
  IMGBB_ENDPOINT: '/api/imgbb',
  /** Days ImgBB keeps the image. 0 = forever. */
  IMGBB_EXPIRY_DAYS: 0,
  /** Long edge of the composited "analyzed" image written to the host. */
  ANALYZED_MAX_EDGE: 1400,
  ANALYZED_QUALITY: 0.9,
  /** Reports fetched per dashboard page. */
  PAGE_SIZE: 24,
} as const;

/**
 * Feature flag for the inference backend.
 *
 * 'gemini' is the only production value. The abstraction is what made swapping
 * the on-device model out for a hosted API a change to one directory rather
 * than a rewrite — see src/ai/engine/registry.ts.
 */
export const ACTIVE_ENGINE = 'gemini' as const;
