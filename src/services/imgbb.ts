import { STORAGE } from '@/config';
import { AppError } from '@/types';

export interface UploadedImage {
  readonly url: string;
  readonly deleteUrl: string;
  readonly bytes: number;
}

/**
 * Upload one image and return its public URL.
 *
 * ImgBB has no access control: the returned URL is viewable by anyone who has
 * it, and the key that produced it is in the bundle. This is a deliberate
 * trade for a keyless-to-the-user reporting flow, and the app states it plainly
 * before the first upload rather than burying it here.
 */
export async function uploadImage(
  blob: Blob,
  name: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<UploadedImage> {
  const base64 = await blobToBase64(blob);

  const form = new FormData();
  form.set('key', apiKey);
  form.set('image', base64);
  form.set('name', name);
  if (STORAGE.IMGBB_EXPIRY_DAYS > 0) {
    form.set('expiration', String(STORAGE.IMGBB_EXPIRY_DAYS * 86_400));
  }

  let response: Response;
  try {
    const init: RequestInit = { method: 'POST', body: form };
    if (signal) init.signal = signal;
    response = await fetch(STORAGE.IMGBB_ENDPOINT, init);
  } catch (cause) {
    throw new AppError('UPLOAD_FAILED', 'The image could not be uploaded.', {
      hint: 'Check your connection. The analysis itself is unaffected.',
      cause,
    });
  }

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { url?: string; delete_url?: string; size?: number };
    error?: { message?: string };
  };

  if (!response.ok || !body.success || !body.data?.url) {
    throw new AppError('UPLOAD_FAILED', 'The image host rejected the upload.', {
      hint:
        response.status === 400
          ? 'Check VITE_IMGBB_API_KEY in your .env file.'
          : 'Try again in a moment.',
      detail: `HTTP ${response.status}: ${body.error?.message ?? response.statusText}`,
    });
  }

  return {
    url: body.data.url,
    deleteUrl: body.data.delete_url ?? '',
    bytes: body.data.size ?? blob.size,
  };
}

/** ImgBB wants bare base64, without the `data:` prefix. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
