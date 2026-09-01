import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { handleConfig, handleGemini, handleImgbb } from '../api/_handlers';

/**
 * Serve the `/api/*` handlers during `vite dev` and `vite preview`.
 *
 * Vite knows nothing about Vercel functions, so without this the proxy would
 * only exist in production — and a credential boundary you cannot exercise
 * locally is one that gets debugged after deploy. This runs the *same* handler
 * module the Vercel functions do; only the request/response adapter differs.
 */
export function apiRoutes(): Plugin {
  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> => {
    const url = req.url?.split('?')[0];
    if (!url?.startsWith('/api/')) return next();

    const send = (status: number, body: unknown) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };

    if (url === '/api/config') {
      const r = handleConfig(process.env);
      send(r.status, r.body);
      return;
    }

    if (req.method !== 'POST') {
      send(405, { error: { message: 'Method not allowed.' } });
      return;
    }

    // Images arrive as base64 and are large; buffer with a ceiling rather than
    // letting a runaway request exhaust memory.
    const MAX = 12 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        const buf = chunk as Buffer;
        size += buf.length;
        if (size > MAX) {
          send(413, { error: { message: 'Request too large.' } });
          return;
        }
        chunks.push(buf);
      }
    } catch {
      send(400, { error: { message: 'Could not read the request body.' } });
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      send(400, { error: { message: 'Body was not valid JSON.' } });
      return;
    }

    const result =
      url === '/api/gemini'
        ? await handleGemini(payload, process.env)
        : url === '/api/imgbb'
          ? await handleImgbb(payload, process.env)
          : { status: 404, body: { error: { message: 'Not found.' } } };

    send(result.status, result.body);
  };

  return {
    name: 'api-routes',

    /**
     * Load unprefixed variables into `process.env` for the dev server.
     *
     * Vite deliberately only exposes `VITE_`-prefixed variables, and only to the
     * client. The handlers read `GEMINI_API_KEY` and `IMGBB_API_KEY` from the
     * process environment — exactly as they will on Vercel — so without this the
     * proxy reports itself unconfigured locally even though `.env` has the keys.
     *
     * The empty prefix loads everything, and only the server process sees it;
     * nothing here reaches the bundle.
     */
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (!key.startsWith('VITE_') && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void middleware(req, res, next));
    },
  };
}
