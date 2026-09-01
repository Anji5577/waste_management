// @ts-check
import { handleConfig } from './_handlers.js';

/**
 * @param {{ method?: string, body?: unknown }} req
 * @param {{ status: (code: number) => any, json: (body: unknown) => void }} res
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'Method not allowed.' } });
    return;
  }
  const result = handleConfig(process.env);
  res.status(result.status).json(result.body);
}
