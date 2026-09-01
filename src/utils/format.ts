import type { WasteCategory } from '@/types';

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export const CATEGORY_LABEL: Record<WasteCategory, string> = {
  WET: 'WET WASTE',
  DRY: 'DRY WASTE',
  HAZARDOUS: 'HAZARDOUS',
  UNCERTAIN: 'NOT SURE',
};

/** The one-line instruction, short enough to read at a glance over a bin. */
export const CATEGORY_ACTION: Record<WasteCategory, string> = {
  WET: 'Green bin — compostable',
  DRY: 'Blue bin — recyclable',
  HAZARDOUS: 'Neither bin — hazardous collection',
  UNCERTAIN: 'Sort this one by hand',
};

export interface CategoryTheme {
  /** Solid fill for the verdict banner. */
  readonly solid: string;
  /** Tinted surface for cards and chips. */
  readonly tint: string;
  readonly border: string;
  /** Text colour on the tinted surface. */
  readonly ink: string;
  /** Stroke for bounding boxes. */
  readonly box: string;
}

/**
 * Bin colours, matching the physical bins the answer refers to.
 *
 * Always paired with an icon and a word — colour alone is not an accessible
 * signal, and WET/HAZARDOUS are exactly the green/red pair that colour-blind
 * users confuse.
 */
export const CATEGORY_STYLE: Record<WasteCategory, CategoryTheme> = {
  WET: {
    solid: 'bg-[#047857] text-white',
    tint: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-900',
    ink: 'text-emerald-900 dark:text-emerald-200',
    box: '#047857',
  },
  DRY: {
    solid: 'bg-[#0369a1] text-white',
    tint: 'bg-sky-50 dark:bg-sky-950/40',
    border: 'border-sky-200 dark:border-sky-900',
    ink: 'text-sky-900 dark:text-sky-200',
    box: '#0369a1',
  },
  HAZARDOUS: {
    solid: 'bg-[#b91c1c] text-white',
    tint: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-900',
    ink: 'text-red-900 dark:text-red-200',
    box: '#b91c1c',
  },
  UNCERTAIN: {
    solid: 'bg-[#b45309] text-white',
    tint: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-900',
    ink: 'text-amber-900 dark:text-amber-200',
    box: '#b45309',
  },
};

export function bandLabel(band: 'high' | 'medium' | 'low'): string {
  return { high: 'High', medium: 'Medium', low: 'Low' }[band];
}
