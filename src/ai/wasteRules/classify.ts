import { CONFIDENCE, DETECTION } from '@/config';
import type { Alternative, AnalyzedObject, BoundingBox, Caveat, WasteCategory } from '@/types';
import { CLASS_RULES, UNCERTAIN_RECOMMENDATION } from './categories';
import type { WasteClass } from '@/types';

export function bandFor(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= CONFIDENCE.HIGH) return 'high';
  if (confidence >= CONFIDENCE.MEDIUM) return 'medium';
  return 'low';
}

export interface ClassifyInput {
  readonly id: string;
  readonly itemName: string;
  readonly material: WasteClass;
  /** The model's self-reported confidence, 0-1. Not a calibrated probability. */
  readonly confidence: number;
  readonly soiled: 'yes' | 'no' | 'unknown';
  readonly box: BoundingBox | null;
  readonly alternatives?: readonly Alternative[];
  readonly smallRegion?: boolean;
  readonly wideScene?: boolean;
}

/**
 * Turn one reported item into a disposal decision.
 *
 * The model names materials; this decides bins. Keeping that split is the whole
 * reason the rules layer survived the move from an on-device classifier to a
 * hosted API unchanged: the consequential step stays deterministic, reviewable
 * and unit-tested, instead of being an opaque property of whichever model
 * version happens to answer.
 */
export function classifyObject(input: ClassifyInput): AnalyzedObject {
  const { id, itemName, material, confidence, soiled, box, wideScene, smallRegion } = input;
  const rule = CLASS_RULES[material];
  const caveats: Caveat[] = [];
  const alternatives = input.alternatives ?? [];

  if (smallRegion) {
    caveats.push({
      code: 'small-region',
      message: 'This item is small in the frame, so there was little detail to go on.',
    });
  }
  if (wideScene) {
    caveats.push({
      code: 'wide-scene',
      message:
        'This photo is a heap or wide view rather than a single item, which makes every reading in it less reliable.',
    });
  }

  const uncertain = (extra: Caveat[]): AnalyzedObject => ({
    id,
    itemName,
    material,
    box,
    alternatives,
    category: 'UNCERTAIN',
    confidence,
    band: 'low',
    caveats: [...caveats, ...extra],
    clarification: null,
    recommendation: UNCERTAIN_RECOMMENDATION,
  });

  // The residual class is not evidence of a stream, however sure the model is.
  if (rule.category === 'UNCERTAIN') {
    return uncertain([
      { code: 'residual-class', message: rule.note ?? 'No specific material matched.' },
    ]);
  }

  const band = bandFor(confidence);
  if (band === 'low') {
    return uncertain([
      {
        code: 'low-score',
        message: `The model was only ${Math.round(confidence * 100)}% sure this is ${rule.displayName.toLowerCase()}.`,
      },
    ]);
  }

  // Soiling is reported as a suggestion, never applied silently.
  //
  // Measured live: an empty, visibly clean plastic bottle was reported
  // `soiled: yes` at 0.95-0.98 on three consecutive runs. The model appears to
  // reason about what a container is *for* rather than what it currently looks
  // like, and that bias points one way — towards "yes" — for exactly the
  // recyclable containers people photograph most. Acting on it directly would
  // route clean recyclables into the compost bin with a confident-looking
  // verdict and no way to tell it was wrong.
  //
  // So the material's own category stands, and the model's reading is surfaced
  // as a pre-flagged question the user can settle in one tap.
  const category: WasteCategory = rule.category;
  const recommendation = rule.recommendation;
  let clarification = rule.clarification;

  if (rule.clarification) {
    if (soiled === 'yes') {
      caveats.push({
        code: 'soiling-suspected',
        message:
          'This may be soiled with food or liquid — if it is, it belongs in wet waste instead. Confirm below.',
      });
    } else if (soiled === 'no') {
      clarification = null;
    } else {
      caveats.push({
        code: 'soiling-unknown',
        message:
          'Whether this is soiled with food or liquid could not be determined, and that would move it to wet waste.',
      });
    }
  }

  if (rule.note && rule.category === 'HAZARDOUS') {
    caveats.push({ code: 'hazardous-handling', message: rule.note });
  }

  return {
    id,
    itemName,
    material,
    box,
    alternatives,
    category,
    confidence,
    band,
    caveats,
    clarification,
    recommendation,
  };
}

/** Re-resolve an object after the user answers the soiling question. */
export function applyClarification(obj: AnalyzedObject, soiled: boolean): AnalyzedObject {
  if (!obj.clarification) return obj;
  const category: WasteCategory = soiled
    ? obj.clarification.yesCategory
    : obj.clarification.noCategory;
  return {
    ...obj,
    category,
    clarification: null,
    caveats: obj.caveats.filter((c) => c.code !== 'soiling-unknown'),
    recommendation: soiled
      ? 'Soiled with food or liquid, so it cannot be recycled — dispose in the wet-waste (green) bin.'
      : obj.recommendation,
  };
}

/** True when a box is too small a slice of the frame to trust. */
export function isSmallRegion(box: BoundingBox | null, width: number, height: number): boolean {
  if (!box || width <= 0 || height <= 0) return false;
  return (box.width * box.height) / (width * height) < DETECTION.MIN_AREA_FRACTION;
}
