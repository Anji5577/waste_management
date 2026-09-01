import { describe, expect, it } from 'vitest';
import type { BoundingBox } from '@/types';
import { chooseStampPlacement, occlusionFraction } from './stampPlacement';

const box = (x: number, y: number, w: number, h: number): BoundingBox => ({
  x,
  y,
  width: w,
  height: h,
});

const W = 1000;
const H = 1000;

describe('chooseStampPlacement', () => {
  it('defaults to the bottom, the conventional position', () => {
    expect(chooseStampPlacement([], W, H)).toBe('bottom');
  });

  it('moves to the top when the items sit along the bottom', () => {
    // The common case for waste: rubbish is on the ground, so a bottom-pinned
    // stamp would cover the very thing the photo is evidence of.
    expect(chooseStampPlacement([box(100, 880, 700, 110)], W, H)).toBe('top');
  });

  it('stays at the bottom when the items sit along the top', () => {
    expect(chooseStampPlacement([box(100, 10, 700, 110)], W, H)).toBe('bottom');
  });

  it('stays at the bottom when nothing is near either edge', () => {
    expect(chooseStampPlacement([box(300, 400, 400, 200)], W, H)).toBe('bottom');
  });

  it('weighs total covered area, not the number of boxes', () => {
    // Three small boxes at the top vs one large one at the bottom: the large
    // one loses more, so the stamp should avoid the bottom.
    const boxes = [
      box(0, 0, 60, 60),
      box(100, 0, 60, 60),
      box(200, 0, 60, 60),
      box(0, 850, 900, 150),
    ];
    expect(chooseStampPlacement(boxes, W, H)).toBe('top');
  });

  it('is stable for degenerate image dimensions', () => {
    expect(chooseStampPlacement([box(0, 0, 10, 10)], 0, 0)).toBe('bottom');
  });
});

describe('occlusionFraction', () => {
  it('is 0 when nothing was detected', () => {
    expect(occlusionFraction([], W, H, 'bottom')).toBe(0);
  });

  it('is 0 when the band is clear', () => {
    expect(occlusionFraction([box(300, 400, 400, 200)], W, H, 'bottom')).toBe(0);
  });

  it('is 1 when the only item lies entirely under the stamp', () => {
    expect(occlusionFraction([box(100, 900, 500, 90)], W, H, 'bottom')).toBeCloseTo(1, 6);
  });

  it('reports partial coverage so the UI can warn instead of hiding it', () => {
    // Band starts at y=780. A box spanning 700-900 has 120 of its 200 rows
    // inside it, so 60% of the item would sit under the panel.
    const f = occlusionFraction([box(0, 700, 100, 200)], W, H, 'bottom');
    expect(f).toBeCloseTo(0.6, 4);
  });
});
