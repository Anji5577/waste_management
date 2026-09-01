import type { Clarification, WasteCategory, WasteClass } from '@/types';
import { WASTE_CLASSES } from '@/types';

/**
 * The rules layer.
 *
 * The classifier predicts *materials*, not disposal streams. This table is the
 * translation, and it is deliberately a plain data structure rather than logic
 * scattered through the UI — the mapping is the part most likely to need local
 * tuning (municipal rules differ), so it should be readable and diffable.
 *
 * Stream names follow India's Solid Waste Management Rules, 2016:
 *   WET       -> green bin, biodegradable, composted
 *   DRY       -> blue bin, recyclable/non-biodegradable
 *   HAZARDOUS -> domestic hazardous, must not enter either household bin
 *   UNCERTAIN -> we do not know; say so rather than guess
 */

export interface ClassRule {
  readonly category: WasteCategory;
  /** Shown as "Detected: ..." — friendlier than the raw model label. */
  readonly displayName: string;
  readonly recommendation: string;
  /**
   * A camera cannot see food residue or moisture. For materials that flip
   * streams when soiled, we ask the user instead of guessing.
   */
  readonly clarification: Clarification | null;
  /** Extra warning appended to the result regardless of confidence. */
  readonly note?: string;
}

const SOILED_QUESTION = 'Is it soiled with food, oil, or liquid?';

function soilingClarification(): Clarification {
  return {
    id: 'soiled',
    question: SOILED_QUESTION,
    // Soiled recyclables contaminate the dry stream and are composted instead.
    yesCategory: 'WET',
    noCategory: 'DRY',
  };
}

export const CLASS_RULES: Readonly<Record<WasteClass, ClassRule>> = {
  battery: {
    category: 'HAZARDOUS',
    displayName: 'Battery',
    recommendation:
      'Do not put this in the wet or dry bin. Batteries leak heavy metals — hand them to an e-waste collection point or your municipality’s hazardous waste drive.',
    clarification: null,
    note: 'Batteries are domestic hazardous waste under SWM Rules 2016.',
  },
  biological: {
    category: 'WET',
    displayName: 'Food / organic waste',
    recommendation:
      'Dispose in the wet-waste (green) bin. This is compostable — keep it free of plastic and packaging.',
    clarification: null,
  },
  'brown-glass': {
    category: 'DRY',
    displayName: 'Glass (brown)',
    recommendation:
      'Dispose in the dry-waste (blue) bin. Rinse it first, and wrap anything broken in paper so it does not injure the collector.',
    clarification: null,
  },
  cardboard: {
    category: 'DRY',
    displayName: 'Cardboard',
    recommendation:
      'Flatten it and dispose in the dry-waste (blue) bin. Wet or grease-stained cardboard cannot be recycled — that goes to wet waste.',
    clarification: soilingClarification(),
  },
  clothes: {
    category: 'DRY',
    displayName: 'Textile / clothing',
    recommendation:
      'Dispose in the dry-waste (blue) bin, but donation or textile recycling is better if the item is still wearable.',
    clarification: null,
  },
  'green-glass': {
    category: 'DRY',
    displayName: 'Glass (green)',
    recommendation:
      'Dispose in the dry-waste (blue) bin. Rinse it first, and wrap anything broken in paper so it does not injure the collector.',
    clarification: null,
  },
  metal: {
    category: 'DRY',
    displayName: 'Metal',
    recommendation:
      'Dispose in the dry-waste (blue) bin. Rinse cans and tins before disposal.',
    clarification: null,
  },
  paper: {
    category: 'DRY',
    displayName: 'Paper',
    recommendation:
      'Dispose in the dry-waste (blue) bin. Used tissues, paper plates and food-soiled paper are wet waste instead.',
    clarification: soilingClarification(),
  },
  plastic: {
    category: 'DRY',
    displayName: 'Plastic',
    recommendation:
      'Rinse and dispose in the dry-waste (blue) bin. Food-contaminated plastic is not recyclable.',
    clarification: soilingClarification(),
  },
  shoes: {
    category: 'DRY',
    displayName: 'Footwear',
    recommendation:
      'Dispose in the dry-waste (blue) bin, or pass to a footwear recycling or donation drive.',
    clarification: null,
  },
  trash: {
    category: 'UNCERTAIN',
    displayName: 'Unrecognised / mixed refuse',
    recommendation:
      'This did not match a specific material. Sort it by hand: food and garden matter to wet waste, clean packaging to dry waste, and batteries, medicines or chemicals to hazardous collection.',
    clarification: null,
    note: '“trash” is the model’s residual bucket — it is not evidence of any particular stream.',
  },
  'white-glass': {
    category: 'DRY',
    displayName: 'Glass (clear)',
    recommendation:
      'Dispose in the dry-waste (blue) bin. Rinse it first, and wrap anything broken in paper so it does not injure the collector.',
    clarification: null,
  },
};

/**
 * Guidance shown when the pipeline cannot commit to a stream.
 *
 * It deliberately covers both reasons a result lands here, because the system
 * cannot reliably tell them apart. Telling someone photographing a rubbish heap
 * to "retake with the item filling more of the frame" is useless advice — there
 * is no single item — and that is the most common real-world UNCERTAIN case.
 *
 * (The model does report a `scene` value, which is used to caveat wide-frame
 * results — but it is a judgement call by the same model, not an independent
 * signal, so it downgrades confidence rather than deciding the wording here.)
 */
export const UNCERTAIN_RECOMMENDATION =
  'Not confident enough to call this. If it is a single item, retake it closer, ' +
  'in good light, against a plain background. If it is a mixed pile, no single ' +
  'answer exists — sort it by hand: food and garden waste to the wet (green) bin, ' +
  'clean packaging to the dry (blue) bin, and batteries, medicines or chemicals ' +
  'to hazardous collection.';

/** Compile-time-ish guarantee that the table covers the model's label set. */
export function assertRulesCoverModel(): void {
  const missing = WASTE_CLASSES.filter((c) => !(c in CLASS_RULES));
  if (missing.length > 0) {
    throw new Error(`CLASS_RULES is missing entries for: ${missing.join(', ')}`);
  }
}
