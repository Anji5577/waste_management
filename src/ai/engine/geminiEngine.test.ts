import { describe, expect, it } from 'vitest';
import { toBox } from './geminiEngine';

/**
 * Gemini reports boxes as [ymin, xmin, ymax, xmax] on a fixed 0-1000 grid.
 * Both the y-first ordering and the fixed scale are easy to get subtly wrong,
 * and the failure mode is boxes that look plausible but sit in the wrong place.
 */
describe('toBox', () => {
  it('converts the y-first 0-1000 grid into source pixels', () => {
    // ymin=100, xmin=200, ymax=600, xmax=800 on a 1000x500 image.
    expect(toBox([100, 200, 600, 800], 1000, 500)).toEqual({
      x: 200,
      y: 50,
      width: 600,
      height: 250,
    });
  });

  it('does not confuse the x and y axes on a non-square image', () => {
    // A box spanning the full width but only the top tenth. If the ordering
    // were read x-first this would come out as a tall, narrow box instead.
    const b = toBox([0, 0, 100, 1000], 800, 400);
    expect(b).toEqual({ x: 0, y: 0, width: 800, height: 40 });
  });

  it('maps a full-frame box to the whole image', () => {
    expect(toBox([0, 0, 1000, 1000], 640, 480)).toEqual({
      x: 0,
      y: 0,
      width: 640,
      height: 480,
    });
  });

  it('clamps a box that overruns the grid', () => {
    const b = toBox([0, 0, 1200, 1200], 100, 100)!;
    expect(b.x + b.width).toBeLessThanOrEqual(100);
    expect(b.y + b.height).toBeLessThanOrEqual(100);
  });

  it('rejects a box with the wrong number of coordinates', () => {
    expect(toBox([1, 2, 3], 100, 100)).toBeNull();
    expect(toBox([], 100, 100)).toBeNull();
  });

  it('rejects a degenerate box rather than drawing a zero-area rectangle', () => {
    expect(toBox([500, 500, 500, 500], 100, 100)).toBeNull();
    expect(toBox([600, 600, 500, 500], 100, 100)).toBeNull();
  });
});
