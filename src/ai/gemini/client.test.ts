import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI } from '@/config';
import { AppError } from '@/types';
import { analyzeImage, analyzeImageWithFallback } from './client';


function reply(payload: unknown, init: { status?: number } = {}) {
  const body =
    init.status && init.status >= 400
      ? payload
      : { steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(payload) }] }] };
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('analyzeImage — request shape', () => {
  it('posts inline base64 image bytes to the interactions endpoint', async () => {
    fetchMock.mockReturnValue(reply({ items: [], scene: 'single-item' }));
    await analyzeImage('QUJD', 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GEMINI.ENDPOINT);
    // Same-origin, and carrying no credential: the proxy attaches the key.
    expect(url.startsWith('/api/')).toBe(true);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBeUndefined();

    const body = JSON.parse(init.body as string) as {
      model: string;
      input: { type: string; data?: string; mime_type?: string }[];
      response_format: { mime_type: string; schema: unknown };
    };
    expect(body.model).toBe(GEMINI.MODEL);
    // The image must go as inline `data`, never as a URI — uploading the photo
    // somewhere else first would be a second disclosure the user never agreed to.
    const image = body.input.find((p) => p.type === 'image');
    expect(image?.data).toBe('QUJD');
    expect(image?.mime_type).toBe('image/jpeg');
    expect(body.response_format.mime_type).toBe('application/json');
    expect(body.response_format.schema).toBeDefined();
  });
});

describe('analyzeImage — response parsing', () => {
  it('reads text from a later step, not blindly from steps[0]', async () => {
    // Reasoning steps can precede the answer; indexing steps[0] would break.
    fetchMock.mockReturnValue(
      Promise.resolve(
        new Response(
          JSON.stringify({
            steps: [
              { type: 'thought', content: [{ type: 'thought', text: '' }] },
              {
                type: 'model_output',
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      items: [
                        {
                          name: 'banana peel',
                          material: 'biological',
                          confidence: 0.9,
                          soiled: 'no',
                          box_2d: [100, 200, 300, 400],
                        },
                      ],
                      scene: 'single-item',
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const r = await analyzeImage('x', 'image/jpeg');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.name).toBe('banana peel');
  });

  it('drops items whose material is not a class the rules layer knows', async () => {
    // The schema is a request, not a guarantee. An unknown material would index
    // straight into the disposal table and produce undefined behaviour.
    fetchMock.mockReturnValue(
      reply({
        items: [
          { name: 'ok', material: 'plastic', confidence: 0.9, soiled: 'no', box_2d: [0, 0, 10, 10] },
          { name: 'bad', material: 'plutonium', confidence: 0.9, soiled: 'no', box_2d: [0, 0, 1, 1] },
        ],
        scene: 'few-items',
      }),
    );
    const r = await analyzeImage('x', 'image/jpeg');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]?.material).toBe('plastic');
  });

  it('drops items with a non-numeric confidence', async () => {
    fetchMock.mockReturnValue(
      reply({
        items: [{ name: 'x', material: 'metal', confidence: 'high', soiled: 'no', box_2d: [0, 0, 1, 1] }],
        scene: 'single-item',
      }),
    );
    expect((await analyzeImage('x', 'image/jpeg')).items).toHaveLength(0);
  });

  it('clamps confidence into 0..1', async () => {
    fetchMock.mockReturnValue(
      reply({
        items: [{ name: 'x', material: 'metal', confidence: 1.7, soiled: 'no', box_2d: [0, 0, 1, 1] }],
        scene: 'single-item',
      }),
    );
    expect((await analyzeImage('x', 'image/jpeg')).items[0]?.confidence).toBe(1);
  });

  it('discards a malformed box rather than drawing it', async () => {
    fetchMock.mockReturnValue(
      reply({
        items: [{ name: 'x', material: 'metal', confidence: 0.9, soiled: 'no', box_2d: [1, 2] }],
        scene: 'single-item',
      }),
    );
    expect((await analyzeImage('x', 'image/jpeg')).items[0]?.box_2d).toEqual([]);
  });

  it('treats an unrecognised soiled value as unknown', async () => {
    fetchMock.mockReturnValue(
      reply({
        items: [{ name: 'x', material: 'paper', confidence: 0.9, soiled: 'maybe', box_2d: [0, 0, 1, 1] }],
        scene: 'single-item',
      }),
    );
    expect((await analyzeImage('x', 'image/jpeg')).items[0]?.soiled).toBe('unknown');
  });

  it('falls back to a safe scene value when the model omits it', async () => {
    fetchMock.mockReturnValue(reply({ items: [] }));
    expect((await analyzeImage('x', 'image/jpeg')).scene).toBe('few-items');
  });

  it('raises a clear error when the response is not JSON', async () => {
    fetchMock.mockReturnValue(
      Promise.resolve(
        new Response(
          JSON.stringify({ steps: [{ content: [{ type: 'text', text: 'sorry, I cannot' }] }] }),
          { status: 200 },
        ),
      ),
    );
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toMatchObject({
      code: 'INFERENCE_FAILED',
    });
  });

  it('raises a clear error when the response carries no text at all', async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response(JSON.stringify({ steps: [] }), { status: 200 })));
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toBeInstanceOf(AppError);
  });
});

describe('analyzeImage — HTTP failures map to actionable errors', () => {
  it.each([
    [401, 'API_KEY_INVALID'],
    [403, 'API_KEY_INVALID'],
    [429, 'API_RATE_LIMITED'],
    [500, 'API_UNAVAILABLE'],
    [503, 'API_UNAVAILABLE'],
    [412, 'API_KEY_MISSING'],
    [400, 'INFERENCE_FAILED'],
  ])('maps HTTP %s to %s', async (statusCode, code) => {
    fetchMock.mockReturnValue(reply({ error: { message: 'nope' } }, { status: statusCode }));
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toMatchObject({ code });
  });

  it('always offers the user a way forward', async () => {
    fetchMock.mockReturnValue(reply({ error: { message: 'nope' } }, { status: 401 }));
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toMatchObject({
      hint: expect.stringContaining('GEMINI_API_KEY'),
    });
  });

  it('keeps a busy upstream retryable, so the model fallback still fires', async () => {
    // If a missing key and an overloaded model shared a status code, a
    // misconfiguration would burn through every fallback before failing.
    fetchMock.mockReturnValue(reply({ error: { message: 'high demand' } }, { status: 503 }));
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
    });
  });

  it('reports a network failure as unreachable, not as a bad image', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(analyzeImage('x', 'image/jpeg')).rejects.toMatchObject({
      code: 'API_UNREACHABLE',
    });
  });
});

describe('analyzeImageWithFallback', () => {
  const overloaded = () =>
    Promise.resolve(
      new Response(JSON.stringify({ error: { message: 'experiencing high demand' } }), {
        status: 500,
      }),
    );
  const ok = () => reply({ items: [], scene: 'single-item' });

  it('moves to the next model when the primary is overloaded', async () => {
    // The real failure this exists for: gemini-3.7-flash returned 500
    // "experiencing high demand" while other models answered fine seconds later.
    fetchMock.mockReturnValueOnce(overloaded()).mockReturnValueOnce(ok());
    const r = await analyzeImageWithFallback('x', 'image/jpeg');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as {
      model: string;
    };
    const second = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string) as {
      model: string;
    };
    expect(first.model).toBe(GEMINI.MODEL);
    expect(second.model).toBe(GEMINI.FALLBACK_MODELS[0]);
    // The caller is told which model actually answered, not the one it asked for.
    expect(r.model).toBe(GEMINI.FALLBACK_MODELS[0]);
  });

  it('retries on rate limiting too', async () => {
    fetchMock
      .mockReturnValueOnce(reply({ error: { message: 'slow down' } }, { status: 429 }))
      .mockReturnValueOnce(ok());
    await expect(analyzeImageWithFallback('x', 'image/jpeg')).resolves.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT burn through every model on a rejected key', async () => {
    // A bad key fails the same way everywhere. Retrying it against the whole
    // list wastes time and buries the actual problem.
    fetchMock.mockReturnValue(reply({ error: { message: 'denied' } }, { status: 403 }));
    await expect(analyzeImageWithFallback('x', 'image/jpeg')).rejects.toMatchObject({
      code: 'API_KEY_INVALID',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a malformed response', async () => {
    fetchMock.mockReturnValue(reply({ error: { message: 'bad request' } }, { status: 400 }));
    await expect(analyzeImageWithFallback('x', 'image/jpeg')).rejects.toBeInstanceOf(AppError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the last real error when every model is down', async () => {
    fetchMock.mockReturnValue(overloaded());
    await expect(analyzeImageWithFallback('x', 'image/jpeg')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1 + GEMINI.FALLBACK_MODELS.length);
  });

  it('uses the configured model by default', async () => {
    fetchMock.mockReturnValue(ok());
    await analyzeImageWithFallback('x', 'image/jpeg');
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as {
      model: string;
    };
    expect(body.model).toBe('gemini-3.5-flash');
  });
});

describe('what leaves the device', () => {
  it('sends only the prompt and the image — no location, no extra fields', async () => {
    // The location badge is drawn *over* the photo in the DOM, never into the
    // pixels, so coordinates are not part of the upload. This asserts the
    // request body stays that way: a future change that folded metadata into
    // the request would silently start disclosing where the user was standing.
    fetchMock.mockReturnValue(reply({ items: [], scene: 'single-item' }));
    await analyzeImage('QUJD', 'image/jpeg');

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string) as Record<
      string,
      unknown
    >;
    expect(Object.keys(body).sort()).toEqual(['input', 'model', 'response_format']);

    const input = body.input as { type: string }[];
    expect(input.map((p) => p.type).sort()).toEqual(['image', 'text']);
    expect(JSON.stringify(body)).not.toMatch(/latitude|longitude|accuracy|geo/i);
  });
});
