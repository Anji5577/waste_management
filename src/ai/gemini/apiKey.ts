import { AppError } from '@/types';

/**
 * What the server will admit about its own configuration.
 *
 * The Gemini and ImgBB keys live in the server environment without a `VITE_`
 * prefix, so they are never inlined into the bundle and the browser cannot read
 * them. It can only ask whether they are *present* — which is all the UI needs
 * to tell the user what to fix.
 */
export interface ServerConfig {
  readonly gemini: boolean;
  readonly imgbb: boolean;
}

let cached: ServerConfig | null = null;

export async function fetchServerConfig(force = false): Promise<ServerConfig> {
  if (cached && !force) return cached;

  let response: Response;
  try {
    response = await fetch('/api/config');
  } catch (cause) {
    throw new AppError('API_KEY_MISSING', 'The server could not be reached.', {
      hint: 'Check your connection. In development, make sure `npm run dev` is running.',
      cause,
    });
  }

  if (!response.ok) {
    throw new AppError('API_KEY_MISSING', 'The server did not report its configuration.', {
      hint: 'On Vercel this endpoint is a serverless function — check the deployment logs.',
      detail: `HTTP ${response.status}`,
    });
  }

  const body = (await response.json().catch(() => null)) as Partial<ServerConfig> | null;
  cached = { gemini: body?.gemini === true, imgbb: body?.imgbb === true };
  return cached;
}

/** Test seam, and used after a retry so a fixed key is picked up. */
export function resetServerConfig(): void {
  cached = null;
}
