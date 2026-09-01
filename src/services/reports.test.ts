import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStorageConfigured, missingStorageConfig, storageHint } from './reports';

afterEach(() => vi.unstubAllEnvs());

function setSupabase(url: string, key: string) {
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
}

describe('missingStorageConfig', () => {
  it('is empty when everything is present', () => {
    setSupabase('https://x.supabase.co', 'anon');
    expect(missingStorageConfig(true)).toEqual([]);
    expect(isStorageConfigured(true)).toBe(true);
  });

  it('names only the image-host key when that is the sole gap', () => {
    // The previous message listed all three every time, so a user who had
    // Supabase set correctly was told to set it again.
    setSupabase('https://x.supabase.co', 'anon');
    expect(missingStorageConfig(false)).toEqual([
      'IMGBB_API_KEY (server-side, no VITE_ prefix)',
    ]);
  });

  it('does not tell the user to set a variable that no longer exists', () => {
    // Regression: it still said VITE_IMGBB_API_KEY after the key moved
    // server-side, so following the instruction exactly fixed nothing.
    setSupabase('', '');
    expect(missingStorageConfig(false).join(' ')).not.toContain('VITE_IMGBB');
  });

  it('names each Supabase variable independently', () => {
    setSupabase('https://x.supabase.co', '');
    expect(missingStorageConfig(true)).toEqual(['VITE_SUPABASE_ANON_KEY']);
    setSupabase('', 'anon');
    expect(missingStorageConfig(true)).toEqual(['VITE_SUPABASE_URL']);
  });

  it('treats whitespace as unset', () => {
    setSupabase('   ', '   ');
    expect(missingStorageConfig(true)).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
  });
});

describe('storageHint', () => {
  it('says nothing when there is nothing to fix', () => {
    setSupabase('https://x.supabase.co', 'anon');
    expect(storageHint(true)).toBe('');
  });

  it('lists the gaps and says where to set them', () => {
    setSupabase('', '');
    const hint = storageHint(false);
    expect(hint).toContain('IMGBB_API_KEY');
    expect(hint).toContain('VITE_SUPABASE_URL');
    expect(hint).toMatch(/\.env|environment variables/);
  });
});
