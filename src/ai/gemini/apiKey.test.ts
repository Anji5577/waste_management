import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiKey, hasApiKey } from './apiKey';

function setKey(value: string | undefined) {
  vi.stubEnv('VITE_GEMINI_API_KEY', value);
}
afterEach(() => vi.unstubAllEnvs());

describe('getApiKey', () => {
  it('returns a configured key, trimmed', () => {
    setKey('  abc123  ');
    expect(getApiKey()).toBe('abc123');
  });

  it.each([undefined, '', '   ', 'your-api-key-here'])(
    'rejects %p with instructions rather than letting a bad request go out',
    (value) => {
      setKey(value);
      expect(() => getApiKey()).toThrowError(/No Gemini API key/);
      expect(hasApiKey()).toBe(false);
    },
  );

  it('names the exact variable and file to fix', () => {
    setKey('');
    try {
      getApiKey();
      expect.unreachable();
    } catch (e) {
      expect((e as { hint?: string }).hint).toMatch(/VITE_GEMINI_API_KEY/);
      expect((e as { hint?: string }).hint).toMatch(/\.env/);
    }
  });
});
