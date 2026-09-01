import { describe, expect, it } from 'vitest';
import { WASTE_CLASSES } from '@/types';
import { CLASS_RULES, assertRulesCoverModel } from './categories';

describe('CLASS_RULES', () => {
  it('covers every class the model can emit', () => {
    expect(() => assertRulesCoverModel()).not.toThrow();
    expect(Object.keys(CLASS_RULES).sort()).toEqual([...WASTE_CLASSES].sort());
  });

  it.each([
    ['biological', 'WET'],
    ['paper', 'DRY'],
    ['cardboard', 'DRY'],
    ['plastic', 'DRY'],
    ['metal', 'DRY'],
    ['brown-glass', 'DRY'],
    ['green-glass', 'DRY'],
    ['white-glass', 'DRY'],
    ['clothes', 'DRY'],
    ['shoes', 'DRY'],
    ['battery', 'HAZARDOUS'],
    ['trash', 'UNCERTAIN'],
  ] as const)('maps %s to %s', (cls, category) => {
    expect(CLASS_RULES[cls].category).toBe(category);
  });

  it('never assumes plastic is dry regardless of soiling', () => {
    // The spec's explicit warning: a food container with residue is not dry.
    expect(CLASS_RULES.plastic.clarification).not.toBeNull();
    expect(CLASS_RULES.plastic.clarification?.yesCategory).toBe('WET');
  });

  it('asks about soiling for exactly the materials that flip stream when soiled', () => {
    const asks = WASTE_CLASSES.filter((c) => CLASS_RULES[c].clarification !== null);
    expect([...asks].sort()).toEqual(['cardboard', 'paper', 'plastic']);
  });

  it('routes batteries out of both household bins', () => {
    expect(CLASS_RULES.battery.category).toBe('HAZARDOUS');
    expect(CLASS_RULES.battery.recommendation).toMatch(/e-waste|hazardous/i);
  });

  it('treats the residual class as unknown rather than guessing a stream', () => {
    expect(CLASS_RULES.trash.category).toBe('UNCERTAIN');
  });

  it('gives every class a non-empty recommendation', () => {
    for (const c of WASTE_CLASSES) {
      expect(CLASS_RULES[c].recommendation.length).toBeGreaterThan(20);
      expect(CLASS_RULES[c].displayName.length).toBeGreaterThan(0);
    }
  });
});
