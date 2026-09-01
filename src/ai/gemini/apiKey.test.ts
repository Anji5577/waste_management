import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/types';
import { fetchServerConfig, resetServerConfig } from './apiKey';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetServerConfig();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const reply = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('fetchServerConfig', () => {
  it('asks the server, and never handles a key itself', async () => {
    // The whole point of the proxy: the browser learns whether a key exists,
    // not what it is.
    fetchMock.mockReturnValue(reply({ gemini: true, imgbb: true }));
    await expect(fetchServerConfig()).resolves.toEqual({ gemini: true, imgbb: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/config');
  });

  it('caches, so every analysis does not re-check', async () => {
    fetchMock.mockReturnValue(reply({ gemini: true, imgbb: false }));
    await fetchServerConfig();
    await fetchServerConfig();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('re-checks when forced, so a fixed key is picked up on retry', async () => {
    fetchMock.mockReturnValue(reply({ gemini: false, imgbb: false }));
    await fetchServerConfig();
    fetchMock.mockReturnValue(reply({ gemini: true, imgbb: true }));
    await expect(fetchServerConfig(true)).resolves.toEqual({ gemini: true, imgbb: true });
  });

  it('treats a missing or malformed field as not configured', async () => {
    fetchMock.mockReturnValue(reply({}));
    await expect(fetchServerConfig()).resolves.toEqual({ gemini: false, imgbb: false });
  });

  it('reports an unreachable server with an actionable hint', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchServerConfig()).rejects.toMatchObject({ code: 'API_KEY_MISSING' });
  });

  it('reports a failing endpoint rather than assuming it is configured', async () => {
    fetchMock.mockReturnValue(reply({ error: 'boom' }, 500));
    await expect(fetchServerConfig()).rejects.toBeInstanceOf(AppError);
  });
});
