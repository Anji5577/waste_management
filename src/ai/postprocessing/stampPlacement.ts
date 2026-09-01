import type { BoundingBox } from '@/types';
import { intersectionArea } from './boxes';

export type StampPlacement = 'bottom' | 'top';

/** Fraction of the image height the stamp panel occupies. */
export const STAMP_BAND = 0.22;

/**
 * Choose the edge that hides the least.
 *
 * A location stamp is a solid panel across one edge of the photo. Pinning it to
 * the bottom unconditionally — as every GPS-camera app does — buries whatever
 * was detected down there, and in a waste photo the items are usually on the
 * ground, i.e. exactly in the bottom band. So the band is chosen by measuring
 * how much detected-object area each one would cover.
 *
 * Bottom wins ties: it is the conventional position, and moving the panel
 * around without cause would be its own kind of noise.
 */
export function chooseStampPlacement(
  boxes: readonly BoundingBox[],
  imageWidth: number,
  imageHeight: number,
  band: number = STAMP_BAND,
): StampPlacement {
  if (boxes.length === 0 || imageWidth <= 0 || imageHeight <= 0) return 'bottom';

  const h = imageHeight * band;
  const topBand: BoundingBox = { x: 0, y: 0, width: imageWidth, height: h };
  const bottomBand: BoundingBox = { x: 0, y: imageHeight - h, width: imageWidth, height: h };

  let topCover = 0;
  let bottomCover = 0;
  for (const b of boxes) {
    topCover += intersectionArea(b, topBand);
    bottomCover += intersectionArea(b, bottomBand);
  }

  return bottomCover > topCover ? 'top' : 'bottom';
}

/**
 * How much of the detected area the chosen band still covers, 0-1.
 *
 * Reported so the UI can admit when neither edge is clear rather than quietly
 * covering something — in a dense heap every edge is occupied, and the honest
 * response is to say the stamp is in the way, not to pretend it isn't.
 */
export function occlusionFraction(
  boxes: readonly BoundingBox[],
  imageWidth: number,
  imageHeight: number,
  placement: StampPlacement,
  band: number = STAMP_BAND,
): number {
  if (boxes.length === 0 || imageWidth <= 0 || imageHeight <= 0) return 0;
  const h = imageHeight * band;
  const strip: BoundingBox = {
    x: 0,
    y: placement === 'top' ? 0 : imageHeight - h,
    width: imageWidth,
    height: h,
  };

  let covered = 0;
  let total = 0;
  for (const b of boxes) {
    covered += intersectionArea(b, strip);
    total += Math.max(0, b.width) * Math.max(0, b.height);
  }
  return total > 0 ? covered / total : 0;
}
