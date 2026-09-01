import type { BoundingBox } from '@/types';

export function area(b: BoundingBox): number {
  return Math.max(0, b.width) * Math.max(0, b.height);
}

export function intersectionArea(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

export function iou(a: BoundingBox, b: BoundingBox): number {
  const overlap = intersectionArea(a, b);
  const union = area(a) + area(b) - overlap;
  return union > 0 ? overlap / union : 0;
}

/**
 * Keep a box inside the image.
 *
 * Necessary because the model reports coordinates on a fixed 0-1000 grid with
 * nothing constraining it to the frame — a slightly over-reaching box would
 * otherwise be drawn outside the photograph it describes.
 */
export function clampToImage(b: BoundingBox, width: number, height: number): BoundingBox {
  const x = Math.max(0, Math.min(b.x, width));
  const y = Math.max(0, Math.min(b.y, height));
  return {
    x,
    y,
    width: Math.max(0, Math.min(b.width, width - x)),
    height: Math.max(0, Math.min(b.height, height - y)),
  };
}
