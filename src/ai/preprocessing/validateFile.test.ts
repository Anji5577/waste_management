import { describe, expect, it } from 'vitest';
import { IMAGE } from '@/config';
import { AppError } from '@/types';
import { sniffMime, validateImageFile } from './validateFile';

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0, 0, 0, 0, 0, 0];

function file(bytes: number[], name: string, type: string, padTo = 0): File {
  const data = new Uint8Array(Math.max(bytes.length, padTo));
  data.set(bytes);
  return new File([data], name, { type });
}

describe('sniffMime', () => {
  it.each([
    ['jpeg', JPEG, 'image/jpeg'],
    ['png', PNG, 'image/png'],
    ['webp', WEBP, 'image/webp'],
  ])('identifies %s from its header', async (_n, bytes, expected) => {
    expect(await sniffMime(new Blob([new Uint8Array(bytes)]))).toBe(expected);
  });

  it('returns null for an unknown format', async () => {
    expect(await sniffMime(new Blob([new Uint8Array(PDF)]))).toBeNull();
  });
});

describe('validateImageFile', () => {
  it('accepts each supported format', async () => {
    for (const bytes of [JPEG, PNG, WEBP]) {
      await expect(validateImageFile(file(bytes, 'a.jpg', 'image/jpeg'))).resolves.toBeUndefined();
    }
  });

  it('rejects a file whose bytes do not match its extension', async () => {
    // The important case: `file.type` and the extension both come from the OS
    // and can be wrong or spoofed. Only the header says what will actually be
    // handed to the decoder.
    const disguised = file(PDF, 'photo.png', 'image/png');
    await expect(validateImageFile(disguised)).rejects.toMatchObject({
      code: 'FILE_TYPE_INVALID',
    });
  });

  it('rejects an empty file', async () => {
    await expect(validateImageFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('rejects a file over the size limit', async () => {
    const big = file(JPEG, 'big.jpg', 'image/jpeg', IMAGE.MAX_FILE_BYTES + 1);
    await expect(validateImageFile(big)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' });
  });

  it('accepts a file exactly at the size limit', async () => {
    const edge = file(JPEG, 'edge.jpg', 'image/jpeg', IMAGE.MAX_FILE_BYTES);
    await expect(validateImageFile(edge)).resolves.toBeUndefined();
  });

  it('surfaces an actionable hint, not a bare failure', async () => {
    await expect(validateImageFile(file(PDF, 'a.pdf', 'application/pdf'))).rejects.toMatchObject({
      hint: expect.stringContaining('.jpg'),
    });
  });
});
