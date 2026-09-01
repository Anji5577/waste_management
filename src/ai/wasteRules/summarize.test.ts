import { describe, expect, it } from 'vitest';
import type { AnalyzedObject, WasteCategory } from '@/types';
import { summarize, tally } from './summarize';

const obj = (id: string, category: WasteCategory): AnalyzedObject => ({
  id,
  itemName: 'test item',
  material: 'plastic',
  box: null,
  alternatives: [],
  category,
  confidence: 0.9,
  band: 'high',
  caveats: [],
  clarification: null,
  recommendation: `dispose as ${category}`,
});

describe('summarize', () => {
  it('reports nothing found for an empty result', () => {
    const s = summarize([]);
    expect(s.headline).toMatch(/no waste item/i);
    expect(s.mixed).toBe(false);
  });

  it('reports a single stream plainly', () => {
    expect(summarize([obj('a', 'DRY')]).headline).toBe('DRY waste');
  });

  it('never collapses a mixed image into one stream', () => {
    // The core failure this app exists to prevent.
    const s = summarize([obj('a', 'WET'), obj('b', 'DRY')]);
    expect(s.mixed).toBe(true);
    expect(s.headline).toContain('WET: 1');
    expect(s.headline).toContain('DRY: 1');
    expect(s.recommendation).toMatch(/separate/i);
  });

  it('warns specifically when a hazardous item is mixed in', () => {
    const s = summarize([obj('a', 'DRY'), obj('b', 'HAZARDOUS')]);
    expect(s.mixed).toBe(true);
    expect(s.recommendation).toMatch(/hazardous/i);
  });

  it('does not treat UNCERTAIN as a stream that makes a result "mixed"', () => {
    const s = summarize([obj('a', 'DRY'), obj('b', 'UNCERTAIN')]);
    expect(s.mixed).toBe(false);
    expect(s.recommendation).toMatch(/could not be identified/i);
  });

  it('reports an all-uncertain multi-object result honestly', () => {
    const s = summarize([obj('a', 'UNCERTAIN'), obj('b', 'UNCERTAIN')]);
    expect(s.mixed).toBe(false);
    expect(s.headline).toMatch(/could not determine/i);
  });

  it('counts every category', () => {
    expect(tally([obj('a', 'WET'), obj('b', 'WET'), obj('c', 'HAZARDOUS')])).toEqual({
      WET: 2,
      DRY: 0,
      HAZARDOUS: 1,
      UNCERTAIN: 0,
    });
  });
});

describe('summarize — wide scenes', () => {
  it('says there is no single stream, rather than implying a failed reading', () => {
    const scene: AnalyzedObject = {
      ...obj('a', 'UNCERTAIN'),
      caveats: [{ code: 'wide-scene', message: 'This photo is a heap or wide view.' }],
    };
    expect(summarize([scene]).headline).toMatch(/no single waste stream/i);
  });

  it('keeps the ordinary wording for a single unidentified item', () => {
    expect(summarize([obj('a', 'UNCERTAIN')]).headline).toMatch(/could not determine/i);
  });
});
