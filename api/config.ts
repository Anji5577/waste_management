import { handleConfig, type HandlerResult } from './_handlers';

interface Req {
  method?: string;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
}

export default function handler(req: Req, res: Res): void {
  if (req.method !== 'GET') {
    res.status(405).json({ error: { message: 'Method not allowed.' } });
    return;
  }
  const result: HandlerResult = handleConfig(process.env);
  res.status(result.status).json(result.body);
}
