import { AppError } from '@/types';

/**
 * Read the build-time Gemini API key.
 *
 * IMPORTANT: `VITE_`-prefixed variables are inlined into the JavaScript bundle
 * at build time. This key is therefore readable by anyone who loads the site —
 * it is not a secret, and a deployed build hands it to every visitor, billed to
 * whoever owns it. That trade-off was chosen deliberately for local and private
 * use; see README → Security before deploying this anywhere public.
 */
export function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!key || key.trim() === '' || key === 'your-api-key-here') {
    throw new AppError('API_KEY_MISSING', 'No Gemini API key is configured.', {
      hint:
        'Copy .env.example to .env, set VITE_GEMINI_API_KEY to a key from Google AI Studio, ' +
        'then restart the dev server.',
    });
  }
  return key.trim();
}

export function hasApiKey(): boolean {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
