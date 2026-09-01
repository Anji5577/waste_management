import { describe, expect, it } from 'vitest';
import type { BoundingBox } from '@/types';
import { area, clampToImage, intersectionArea, iou } from './boxes';

const box = (x: number, y: number, w: number, h: number): BoundingBox => ({
  x,
  y,
  width: w,
  height: h,
});

describe('area', () => {
  it('multiplies the sides', () => {
    expect(area(box(0, 0, 10, 5))).toBe(50);
  });
  it('treats negative dimensions as empty rather than negative', () => {
    expect(area(box(0, 0, -10, 5))).toBe(0);
  });
});

describe('intersectionArea', () => {
  it('is 0 for disjoint boxes', () => {
    expect(intersectionArea(box(0, 0, 10, 10), box(50, 50, 10, 10))).toBe(0);
  });
  it('computes the overlapping region', () => {
    expect(intersectionArea(box(0, 0, 10, 10), box(5, 0, 10, 10))).toBe(50);
  });
});

describe('iou', () => {
  it('is 1 for identical boxes', () => {
    expect(iou(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBe(1);
  });
  it('is 0 for disjoint boxes', () => {
    expect(iou(box(0, 0, 10, 10), box(50, 50, 10, 10))).toBe(0);
  });
  it('computes partial overlap', () => {
    expect(iou(box(0, 0, 10, 10), box(5, 0, 10, 10))).toBeCloseTo(50 / 150, 6);
  });
  it('is 0 for zero-area boxes rather than dividing by zero', () => {
    expect(iou(box(0, 0, 0, 0), box(0, 0, 0, 0))).toBe(0);
  });
});

describe('clampToImage', () => {
  it('trims a box that runs past the edge', () => {
    // The model reports on a fixed 0-1000 grid, so over-reaching boxes are
    // routine rather than exceptional.
    expect(clampToImage(box(90, 90, 50, 50), 100, 100)).toEqual(box(90, 90, 10, 10));
  });
  it('pulls negative origins back to zero', () => {
    expect(clampToImage(box(-10, -10, 50, 50), 100, 100)).toEqual(box(0, 0, 50, 50));
  });
  it('leaves an already-contained box untouched', () => {
    expect(clampToImage(box(10, 10, 20, 20), 100, 100)).toEqual(box(10, 10, 20, 20));
  });
});
