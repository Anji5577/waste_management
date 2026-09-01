import { useState } from 'react';
import { useReports } from '@/hooks/useReports';
import { deleteReport, type StoredReport } from '@/services/reports';
import { AppError } from '@/types';
import { downloadReport } from '@/utils/reportPdf';
import { ErrorNotice } from '@/components/common/ErrorNotice';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { CATEGORY_STYLE } from '@/utils/format';
import type { WasteCategory } from '@/types';

const STREAMS: WasteCategory[] = ['WET', 'DRY', 'HAZARDOUS', 'UNCERTAIN'];

function Tally({ tally }: { tally: Record<string, number> }) {
  const present = STREAMS.filter((s) => (tally[s] ?? 0) > 0);
  if (present.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {present.map((s) => (
        <li
          key={s}
          className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold ${CATEGORY_STYLE[s].solid}`}
        >
          <CategoryIcon category={s} className="size-3" />
          {tally[s]} {s}
        </li>
      ))}
    </ul>
  );
}

function ReportCard({ report, onDeleted }: { report: StoredReport; onDeleted: () => void }) {
  const when = new Date(report.taken_at ?? report.created_at);
  const thumb = report.analyzed_url ?? report.original_url;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  return (
    <article className="border border-[var(--border)] bg-[var(--surface-raised)]">
      <img
        src={thumb}
        alt={`Report from ${when.toLocaleString()}`}
        loading="lazy"
        className="block aspect-[4/3] w-full object-cover"
      />
      <div className="p-3">
        <p className="text-base font-bold leading-snug">{report.summary_headline}</p>
        <Tally tally={report.tally} />

        <dl className="mt-2 space-y-0.5 text-sm text-[var(--text-muted)]">
          <div>
            <dt className="sr-only">Taken</dt>
            <dd>{when.toLocaleString()}</dd>
          </div>
          {report.place_region && (
            <div>
              <dt className="sr-only">Place</dt>
              <dd className="truncate">{report.place_region}</dd>
            </div>
          )}
          {report.latitude !== null && report.longitude !== null && (
            <div>
              <dt className="sr-only">Coordinates</dt>
              <dd className="font-mono text-xs tabular-nums">
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBuilding(true);
              void downloadReport(report)
                .catch(() =>
                  setError(
                    new AppError('REPORT_DOWNLOAD_FAILED', 'The PDF could not be built.', {
                      hint: 'Check your connection — the images are fetched to embed them.',
                    }),
                  ),
                )
                .finally(() => setBuilding(false));
            }}
            disabled={building}
            className="tap inline-flex items-center px-3 text-sm font-semibold text-white bg-[var(--color-brand-accent)] hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-45"
          >
            {building ? 'Building PDF…' : 'Download PDF'}
          </button>
          <a
            href={report.original_url}
            target="_blank"
            rel="noreferrer noopener"
            className="tap inline-flex items-center border border-[var(--border)] px-3 text-sm font-semibold"
          >
            Original
          </a>
          {report.analyzed_url && (
            <a
              href={report.analyzed_url}
              target="_blank"
              rel="noreferrer noopener"
              className="tap inline-flex items-center border border-[var(--border)] px-3 text-sm font-semibold"
            >
              Analysed
            </a>
          )}
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={`Delete report from ${when.toLocaleString()}`}
            className="tap ml-auto inline-flex items-center border border-red-300 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete
          </button>
        </div>

        {error && !confirming && (
          <p className="mt-2 text-sm text-red-700 dark:text-red-300">
            {error.message} {error.hint}
          </p>
        )}

        {confirming && (
          <div className="mt-3 border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/50">
            <p className="text-sm font-bold text-red-900 dark:text-red-200">
              Delete this report?
            </p>
            {/* Stated plainly: ImgBB's delete URL is a page, not an endpoint,
                so the images are not ours to remove. */}
            <p className="mt-1 text-sm text-red-800 dark:text-red-300">
              This removes the record. The uploaded images stay on the public image host —
              {report.delete_url ? ' remove them yourself:' : ' they cannot be removed from here.'}
              {report.delete_url && (
                <>
                  {' '}
                  <a
                    href={report.delete_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold underline underline-offset-2"
                  >
                    open the image host’s delete page
                  </a>
                  .
                </>
              )}
            </p>
            {error && <p className="mt-2 text-sm text-red-800 dark:text-red-300">{error.message} {error.hint}</p>}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  setError(null);
                  void deleteReport(report.id)
                    .then(onDeleted)
                    .catch((e: unknown) =>
                      setError(
                        e instanceof AppError
                          ? e
                          : new AppError('REPORT_DELETE_FAILED', 'The report could not be deleted.'),
                      ),
                    )
                    .finally(() => setDeleting(false));
                }}
                className="tap inline-flex items-center bg-red-700 px-3 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-45"
              >
                {deleting ? 'Deleting…' : 'Delete report'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                className="tap inline-flex items-center border border-[var(--border)] px-3 text-sm font-semibold"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function Dashboard({
  active,
  imgbbAvailable,
}: {
  active: boolean;
  imgbbAvailable: boolean;
}) {
  const { state, reload } = useReports(active, imgbbAvailable);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <p aria-live="polite" className="py-8 text-center text-[var(--text-muted)]">
        Loading saved reports…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="py-4">
        <ErrorNotice error={state.error} onRetry={() => void reload()} retryLabel="Try again" />
      </div>
    );
  }

  if (state.reports.length === 0) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-center">
        <p className="text-lg font-bold">No reports yet</p>
        <p className="mt-1 text-[var(--text-muted)]">
          Analyse a photo and save it — it will appear here with both images, the verdict, and
          where it was taken.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        {state.reports.length} report{state.reports.length === 1 ? '' : 's'} from this device.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {state.reports.map((r) => (
          <ReportCard key={r.id} report={r} onDeleted={() => void reload()} />
        ))}
      </div>
    </div>
  );
}
