import { describe, expect, it } from 'vitest';
import { CONFIDENCE } from '@/config';
import type { BoundingBox, WasteClass } from '@/types';
import { applyClarification, bandFor, classifyObject, isSmallRegion } from './classify';

const base = {
  id: 'o1',
  itemName: 'test item',
  box: null,
  soiled: 'unknown' as const,
};

function item(material: WasteClass, confidence: number, over: Record<string, unknown> = {}) {
  return { ...base, material, confidence, ...over };
}

describe('bandFor', () => {
  it.each([
    [1, 'high'],
    [CONFIDENCE.HIGH, 'high'],
    [CONFIDENCE.HIGH - 0.0001, 'medium'],
    [CONFIDENCE.MEDIUM, 'medium'],
    [CONFIDENCE.MEDIUM - 0.0001, 'low'],
    [0, 'low'],
  ])('maps %s to %s', (value, expected) => {
    expect(bandFor(value)).toBe(expected);
  });
});

describe('classifyObject — confident cases', () => {
  it('calls biological WET', () => {
    const r = classifyObject(item('biological', 0.95));
    expect(r.category).toBe('WET');
    expect(r.band).toBe('high');
  });

  it('calls metal DRY', () => {
    expect(classifyObject(item('metal', 0.9)).category).toBe('DRY');
  });

  it('calls battery HAZARDOUS and attaches handling guidance', () => {
    const r = classifyObject(item('battery', 0.92));
    expect(r.category).toBe('HAZARDOUS');
    expect(r.caveats.map((c) => c.code)).toContain('hazardous-handling');
  });

  it('keeps the material the rule was keyed on, alongside the model’s own name', () => {
    const r = classifyObject(item('biological', 0.9, { itemName: 'banana peel' }));
    expect(r.itemName).toBe('banana peel');
    expect(r.material).toBe('biological');
  });
});

describe('classifyObject — refuses to guess', () => {
  it('returns UNCERTAIN below the confidence threshold', () => {
    const r = classifyObject(item('plastic', CONFIDENCE.MEDIUM - 0.01));
    expect(r.category).toBe('UNCERTAIN');
    expect(r.caveats.map((c) => c.code)).toContain('low-score');
  });

  it('never converts the residual "trash" class into WET or DRY, however sure', () => {
    const r = classifyObject(item('trash', 0.99));
    expect(r.category).toBe('UNCERTAIN');
    expect(r.caveats.map((c) => c.code)).toContain('residual-class');
  });

  it('flags a wide scene as less reliable', () => {
    const r = classifyObject(item('plastic', 0.9, { wideScene: true }));
    expect(r.caveats.map((c) => c.code)).toContain('wide-scene');
  });

  it('flags a region too small to read', () => {
    const r = classifyObject(item('plastic', 0.9, { smallRegion: true }));
    expect(r.caveats.map((c) => c.code)).toContain('small-region');
  });
});

describe('classifyObject — soiling', () => {
  it('never lets the model’s soiling guess silently change the bin', () => {
    // Measured live: a clean, empty plastic bottle was reported soiled=yes at
    // 0.95-0.98 on three consecutive runs. Acting on that directly would send
    // clean recyclables to the compost bin with a confident-looking verdict.
    const r = classifyObject(item('plastic', 0.95, { soiled: 'yes' }));
    expect(r.category).toBe('DRY');
  });

  it('surfaces the suspicion and leaves the user one tap from correcting it', () => {
    const r = classifyObject(item('paper', 0.9, { soiled: 'yes' }));
    expect(r.caveats.map((c) => c.code)).toContain('soiling-suspected');
    expect(r.clarification).not.toBeNull();
    expect(r.clarification?.yesCategory).toBe('WET');
  });

  it('stops asking when the model is confident the item is clean', () => {
    const r = classifyObject(item('cardboard', 0.9, { soiled: 'no' }));
    expect(r.category).toBe('DRY');
    expect(r.clarification).toBeNull();
    expect(r.caveats.map((c) => c.code)).not.toContain('soiling-unknown');
  });

  it('asks, and says why, when the model cannot tell', () => {
    const r = classifyObject(item('plastic', 0.9, { soiled: 'unknown' }));
    expect(r.category).toBe('DRY');
    expect(r.clarification).not.toBeNull();
    expect(r.caveats.map((c) => c.code)).toContain('soiling-unknown');
  });

  it('never asks about materials that do not change stream when soiled', () => {
    for (const soiled of ['yes', 'no', 'unknown'] as const) {
      expect(classifyObject(item('metal', 0.9, { soiled })).clarification).toBeNull();
      expect(classifyObject(item('battery', 0.9, { soiled })).clarification).toBeNull();
      expect(classifyObject(item('biological', 0.9, { soiled })).clarification).toBeNull();
    }
  });
});

describe('applyClarification', () => {
  it('moves soiled paper to WET', () => {
    const r = classifyObject(item('paper', 0.9));
    const answered = applyClarification(r, true);
    expect(answered.category).toBe('WET');
    expect(answered.clarification).toBeNull();
    expect(answered.caveats.map((c) => c.code)).not.toContain('soiling-unknown');
  });

  it('keeps clean paper in DRY', () => {
    expect(applyClarification(classifyObject(item('paper', 0.9)), false).category).toBe('DRY');
  });

  it('is a no-op when no question is pending', () => {
    const r = classifyObject(item('metal', 0.9));
    expect(applyClarification(r, true)).toBe(r);
  });
});

describe('isSmallRegion', () => {
  const box = (w: number, h: number): BoundingBox => ({ x: 0, y: 0, width: w, height: h });

  it('flags a speck in a large image', () => {
    expect(isSmallRegion(box(5, 5), 1000, 1000)).toBe(true);
  });
  it('accepts a reasonably sized region', () => {
    expect(isSmallRegion(box(400, 400), 1000, 1000)).toBe(false);
  });
  it('is false when there is no box at all', () => {
    expect(isSmallRegion(null, 1000, 1000)).toBe(false);
  });
});
