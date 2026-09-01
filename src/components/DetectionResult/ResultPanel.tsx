import { useState } from 'react';
import type { AnalysisResult, WasteCategory } from '@/types';
import { ObjectCard } from './ObjectCard';
import { VerdictBanner } from './VerdictBanner';

interface Props {
  result: AnalysisResult;
  onAnswerClarification: (objectId: string, soiled: boolean) => void;
  onHoverObject?: (id: string | null) => void;
}

export function ResultPanel({ result, onAnswerClarification, onHoverObject }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const { summary, objects } = result;
  const boxed = objects.some((o) => o.box !== null);

  const decided = [...new Set(objects.map((o) => o.category))].filter(
    (c): c is WasteCategory => c !== 'UNCERTAIN',
  );
  const primary =
    !summary.mixed && objects.length > 0 ? (decided[0] ?? objects[0]?.category ?? null) : null;

  return (
    <div className="space-y-4">
      <VerdictBanner summary={summary} primary={primary} />

      {objects.length > 0 && (
        <>
          <h3 className="px-1 pt-2 text-sm font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {objects.length === 1 ? 'The item' : `${objects.length} items found`}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {objects.map((o, i) => (
              <ObjectCard
                key={o.id}
                object={o}
                index={boxed ? i + 1 : null}
                onAnswerClarification={onAnswerClarification}
                {...(onHoverObject ? { onHover: onHoverObject } : {})}
              />
            ))}
          </div>
        </>
      )}

      <div className="rounded-none border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm text-[var(--text-muted)]">
        <p>
          Confidence is the model’s own estimate of how sure it is. It is a self-report, not a
          calibrated probability — it has not been checked against how often the model is
          actually right, and language models tend to overstate it.
        </p>
        <button
          type="button"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
          className="tap mt-1 inline-flex items-center font-medium underline underline-offset-4"
        >
          {showDetail ? 'Hide' : 'Show'} analysis detail
        </button>
        {showDetail && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 tabular-nums">
            <div>
              <dt className="inline">API request</dt>{' '}
              <dd className="inline font-semibold">{result.timings.requestMs} ms</dd>
            </div>
            <div>
              <dt className="inline">Total</dt>{' '}
              <dd className="inline font-semibold">{result.timings.totalMs} ms</dd>
            </div>
            <div>
              <dt className="inline">Scene</dt>{' '}
              <dd className="inline font-semibold">{result.scene}</dd>
            </div>

          </dl>
        )}
      </div>
    </div>
  );
}
