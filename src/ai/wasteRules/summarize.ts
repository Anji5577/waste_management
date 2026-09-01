import type { AnalysisSummary, AnalyzedObject, CategoryTally } from '@/types';

const EMPTY: CategoryTally = { WET: 0, DRY: 0, HAZARDOUS: 0, UNCERTAIN: 0 };

export function tally(objects: readonly AnalyzedObject[]): CategoryTally {
  return objects.reduce<CategoryTally>(
    (acc, o) => ({ ...acc, [o.category]: acc[o.category] + 1 }),
    EMPTY,
  );
}

/**
 * Roll per-object results into one verdict.
 *
 * The rule that matters: a frame containing both a banana peel and a bottle is
 * never reported as a single stream. Collapsing it would tell the user to put
 * food waste in the recycling, which is the exact failure this app exists to
 * prevent.
 */
export function summarize(objects: readonly AnalyzedObject[]): AnalysisSummary {
  const counts = tally(objects);

  if (objects.length === 0) {
    return {
      tally: counts,
      mixed: false,
      headline: 'No waste item recognised',
      recommendation:
        'Nothing identifiable was found. Move closer, fill more of the frame with the item, and use even lighting against a plain background.',
    };
  }

  const decided = (['WET', 'DRY', 'HAZARDOUS'] as const).filter((c) => counts[c] > 0);
  const mixed = decided.length > 1;

  if (mixed) {
    const parts = decided.map((c) => `${c}: ${counts[c]}`).join(', ');
    return {
      tally: counts,
      mixed: true,
      headline: `Multiple waste types detected — ${parts}`,
      recommendation: counts.HAZARDOUS
        ? 'Separate these before disposal, and keep the hazardous item out of both household bins.'
        : 'Separate the items before disposal — wet waste in the green bin, dry waste in the blue bin.',
    };
  }

  if (objects.length === 1) {
    const only = objects[0];
    if (!only) return { tally: counts, mixed: false, headline: '', recommendation: '' };
    return {
      tally: counts,
      mixed: false,
      headline:
        only.category === 'UNCERTAIN'
          ? only.caveats.some((c) => c.code === 'wide-scene')
            ? 'No single waste stream for this photo'
            : 'Could not determine the waste stream'
          : `${only.category} waste`,
      recommendation: only.recommendation,
    };
  }

  const single = decided[0];
  if (!single) {
    return {
      tally: counts,
      mixed: false,
      headline: `Could not determine the waste stream for ${objects.length} items`,
      recommendation:
        'None of the detected items could be classified confidently. Photograph them one at a time.',
    };
  }

  const uncertainSuffix = counts.UNCERTAIN
    ? ` ${counts.UNCERTAIN} further item${counts.UNCERTAIN > 1 ? 's' : ''} could not be identified.`
    : '';
  return {
    tally: counts,
    mixed: false,
    headline: `${counts[single]} ${single} waste item${counts[single] > 1 ? 's' : ''}`,
    recommendation:
      (objects.find((o) => o.category === single)?.recommendation ?? '') + uncertainSuffix,
  };
}
