import type { AnalyzedObject } from '@/types';
import { CATEGORY_LABEL, CATEGORY_STYLE, bandLabel, percent } from '@/utils/format';
import { CLASS_RULES } from '@/ai/wasteRules';
import { CategoryIcon } from '@/components/common/CategoryIcon';

interface Props {
  object: AnalyzedObject;
  index: number | null;
  onAnswerClarification: (objectId: string, soiled: boolean) => void;
  onHover?: (id: string | null) => void;
}

export function ObjectCard({ object, index, onAnswerClarification, onHover }: Props) {
  const theme = CATEGORY_STYLE[object.category];
  const name = object.itemName.replace(/^./, (c) => c.toUpperCase());

  return (
    <article
      onMouseEnter={() => onHover?.(object.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`overflow-hidden rounded-none border ${theme.border} ${theme.tint}`}
    >
      <header className="flex items-start gap-3 p-4">
        {index !== null && (
          <span
            aria-hidden
            className={`grid size-7 shrink-0 place-items-center rounded-none text-sm font-bold ${theme.solid}`}
          >
            {index}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-tight">{name}</h3>
          <p className="text-sm text-[var(--text-muted)]">
            {CLASS_RULES[object.material].displayName}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${theme.solid}`}
        >
          <CategoryIcon category={object.category} className="size-3.5" />
          {CATEGORY_LABEL[object.category]}
        </span>
      </header>

      <div className="space-y-4 border-t border-black/5 p-4 dark:border-white/10">
        <p className="text-base leading-relaxed">{object.recommendation}</p>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-[var(--text-muted)]">
              Model confidence (self-reported)
            </span>
            <span className="text-sm font-bold tabular-nums">
              {percent(object.confidence)} · {bandLabel(object.band)}
            </span>
          </div>
          {/* A bar reads faster than a number when you are scanning. */}
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
            role="img"
            aria-label={`Self-reported confidence ${percent(object.confidence)}`}
          >
            <div
              className={`h-full rounded-full ${theme.solid}`}
              style={{ width: `${Math.max(4, Math.round(object.confidence * 100))}%` }}
            />
          </div>
        </div>

        {object.clarification && (
          <div className="rounded-none border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="text-base font-semibold">{object.clarification.question}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onAnswerClarification(object.id, true)}
                className="tap rounded-none bg-[var(--color-brand-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)]"
              >
                Yes — it’s soiled
              </button>
              <button
                type="button"
                onClick={() => onAnswerClarification(object.id, false)}
                className="tap rounded-none border border-[var(--border)] px-3 text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/5"
              >
                No — it’s clean
              </button>
            </div>
          </div>
        )}

        {object.caveats.length > 0 && (
          <ul className="space-y-1.5 text-sm text-[var(--text-muted)]">
            {object.caveats.map((c) => (
              <li key={c.code} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-current" />
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        )}

        {object.alternatives.length > 0 && (
          <details className="group">
            <summary className="tap flex cursor-pointer list-none items-center text-sm font-medium text-[var(--text-muted)]">
              Other possibilities
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="ml-1 size-4 transition-transform group-open:rotate-180"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <ul className="mt-1 space-y-1.5 text-sm">
              {object.alternatives.map((c) => (
                <li key={c.label} className="flex justify-between gap-4 tabular-nums">
                  <span>{CLASS_RULES[c.label].displayName}</span>
                  <span className="text-[var(--text-muted)]">{percent(c.confidence)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}
