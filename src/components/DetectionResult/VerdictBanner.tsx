import type { AnalysisSummary, CategoryTally, WasteCategory } from '@/types';
import { CATEGORY_ACTION, CATEGORY_LABEL, CATEGORY_STYLE } from '@/utils/format';
import { CategoryIcon } from '@/components/common/CategoryIcon';

interface Props {
  summary: AnalysisSummary;
  /** The single stream, or null when the photo holds more than one. */
  primary: WasteCategory | null;
}

const ORDER: WasteCategory[] = ['WET', 'DRY', 'HAZARDOUS', 'UNCERTAIN'];

function Chips({ tally }: { tally: CategoryTally }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {ORDER.filter((c) => tally[c] > 0).map((c) => (
        <li
          key={c}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${CATEGORY_STYLE[c].solid}`}
        >
          <CategoryIcon category={c} className="size-4" />
          {tally[c]} {CATEGORY_LABEL[c]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The answer, made unmissable.
 *
 * This exists because an audit of the previous layout found the verdict
 * rendered at 20px, 986px down a 4-screen page — below the fold on a phone,
 * which is the one place this app is used. The verdict is now the first thing
 * after the photo, full-bleed, in the bin's own colour, at a size readable at
 * arm's length while standing over a bin.
 */
export function VerdictBanner({ summary, primary }: Props) {
  if (primary && !summary.mixed) {
    const theme = CATEGORY_STYLE[primary];
    return (
      <section
        aria-labelledby="result-heading"
        className={`rounded-none p-5 sm:p-6 ${theme.solid}`}
      >
        <h2 id="result-heading" className="text-xs font-bold uppercase tracking-[0.14em] opacity-80">
          Result
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <CategoryIcon category={primary} className="size-10 shrink-0 sm:size-12" />
          <p className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-[2.5rem]">
            {CATEGORY_LABEL[primary]}
          </p>
        </div>
        <p className="mt-3 text-lg font-semibold">{CATEGORY_ACTION[primary]}</p>
        <p className="mt-1 text-sm leading-relaxed opacity-90">{summary.recommendation}</p>
      </section>
    );
  }

  // Mixed, or nothing recognised — a neutral surface, because claiming a bin
  // colour here would be exactly the wrong signal.
  return (
    <section
      aria-labelledby="result-heading"
      className="rounded-none border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6"
    >
      <h2
        id="result-heading"
        className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]"
      >
        Result
      </h2>
      <p className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
        {summary.mixed ? 'Mixed waste' : summary.headline}
      </p>
      {summary.mixed && <Chips tally={summary.tally} />}
      <p className="mt-3 text-base leading-relaxed text-[var(--text-muted)]">
        {summary.recommendation}
      </p>
    </section>
  );
}
