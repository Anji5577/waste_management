import { IMAGE } from '@/config';
import { AppError } from '@/types';

/**
 * Read the first `n` bytes without pulling a 20 MB file into memory.
 *
 * `Blob.arrayBuffer()` is the fast path. The FileReader fallback is not
 * ceremony: Safari below 14 has no `Blob.arrayBuffer`, and neither does jsdom,
 * so without it validation would throw on a perfectly valid image.
 */
async function readHeader(file: Blob, n: number): Promise<Uint8Array> {
  const head = file.slice(0, n);
  if (typeof head.arrayBuffer === 'function') {
    return new Uint8Array(await head.arrayBuffer()).subarray(0, n);
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(head);
  });
  return new Uint8Array(buffer).subarray(0, n);
}

const MAGIC: ReadonlyArray<{ mime: string; bytes: readonly number[]; offset: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff], offset: 0 },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 },
  // WEBP is "RIFF....WEBP"; the size field sits between, so check the tag at 8.
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
];

/**
 * Identify a file by its actual bytes.
 *
 * `file.type` comes from the OS and the extension, and both lie — a `.png` that
 * is really a PDF would otherwise reach the decoder. Sniffing the header is the
 * only check that reflects what we will actually try to decode.
 */
export async function sniffMime(file: Blob): Promise<string | null> {
  const header = await readHeader(file, 12);
  for (const sig of MAGIC) {
    const matches = sig.bytes.every((b, i) => header[sig.offset + i] === b);
    if (matches) return sig.mime;
  }
  return null;
}

export async function validateImageFile(file: File): Promise<void> {
  if (file.size === 0) {
    throw new AppError('FILE_TYPE_INVALID', 'That file is empty.');
  }
  if (file.size > IMAGE.MAX_FILE_BYTES) {
    const mb = (IMAGE.MAX_FILE_BYTES / 1024 / 1024).toFixed(0);
    throw new AppError(
      'FILE_TOO_LARGE',
      `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB, over the ${mb} MB limit.`,
      { hint: 'Take the photo at a lower resolution, or resize it before uploading.' },
    );
  }

  const sniffed = await sniffMime(file);
  if (!sniffed || !(IMAGE.ACCEPTED_MIME as readonly string[]).includes(sniffed)) {
    throw new AppError(
      'FILE_TYPE_INVALID',
      'That file is not a JPG, PNG, or WEBP image.',
      {
        hint: `Accepted formats: ${IMAGE.ACCEPTED_EXTENSIONS.join(', ')}.`,
        detail: `declared="${file.type || 'none'}" sniffed="${sniffed ?? 'unknown'}"`,
      },
    );
  }
}
