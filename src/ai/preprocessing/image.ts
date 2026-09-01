import { IMAGE } from '@/config';
import { AppError, type BoundingBox } from '@/types';

/** A decoded, orientation-corrected, inference-sized frame. */
export interface PreparedImage {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  /** Dimensions before downscaling, so boxes can be reported in source pixels. */
  readonly sourceWidth: number;
  readonly sourceHeight: number;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function context2d(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new AppError('IMAGE_DECODE_FAILED', 'Could not prepare the image for analysis.', {
      hint: 'Your browser blocked canvas rendering. Try a different browser.',
    });
  }
  return ctx;
}

/**
 * Decode a Blob to a bitmap with EXIF orientation applied.
 *
 * Phone cameras routinely store a portrait photo as landscape pixels plus an
 * orientation flag. Ignoring it feeds the classifier a sideways image, which
 * measurably degrades results — `imageOrientation: 'from-image'` is what stops
 * that happening.
 */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch (cause) {
    try {
      return await createImageBitmap(blob);
    } catch {
      throw new AppError('IMAGE_DECODE_FAILED', 'That image could not be opened.', {
        hint: 'The file may be corrupt or use an unsupported encoding. Try a different photo.',
        cause,
      });
    }
  }
}

/** Downscale so the long edge is at most MAX_INFERENCE_EDGE, preserving aspect. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = IMAGE.MAX_INFERENCE_EDGE,
): { width: number; height: number; scale: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function prepareImage(
  source: ImageBitmap | HTMLVideoElement | HTMLCanvasElement,
): PreparedImage {
  const sourceWidth =
    'videoWidth' in source && source.videoWidth ? source.videoWidth : source.width;
  const sourceHeight =
    'videoHeight' in source && source.videoHeight ? source.videoHeight : source.height;

  if (sourceWidth < IMAGE.MIN_DIMENSION || sourceHeight < IMAGE.MIN_DIMENSION) {
    throw new AppError(
      'IMAGE_TOO_SMALL',
      `That image is only ${sourceWidth}x${sourceHeight} pixels.`,
      { hint: `Images need to be at least ${IMAGE.MIN_DIMENSION}x${IMAGE.MIN_DIMENSION}.` },
    );
  }

  const fit = fitWithin(sourceWidth, sourceHeight);
  const canvas = makeCanvas(fit.width, fit.height);
  const ctx = context2d(canvas);
  ctx.drawImage(source, 0, 0, fit.width, fit.height);
  return {
    canvas,
    width: fit.width,
    height: fit.height,
    sourceWidth,
    sourceHeight,
  };
}

/** Cut a region out of a prepared frame for per-object classification. */
export function cropRegion(
  image: PreparedImage,
  box: BoundingBox,
): HTMLCanvasElement | OffscreenCanvas {
  const w = Math.max(1, Math.round(box.width));
  const h = Math.max(1, Math.round(box.height));
  const canvas = makeCanvas(w, h);
  context2d(canvas).drawImage(
    image.canvas,
    Math.round(box.x),
    Math.round(box.y),
    w,
    h,
    0,
    0,
    w,
    h,
  );
  return canvas;
}

export function toImageData(canvas: HTMLCanvasElement | OffscreenCanvas): ImageData {
  return context2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
}

/** For previews and camera stills — never uploaded anywhere. */
export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => {
    (canvas).toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
      type,
      quality,
    );
  });
}
