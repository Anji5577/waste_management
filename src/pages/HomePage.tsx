import { useCallback, useEffect, useRef, useState } from 'react';
import { useModel } from '@/hooks/useModel';
import { useAnalysis } from '@/hooks/useAnalysis';
import { ImageUpload } from '@/components/ImageUpload/ImageUpload';
import { CameraCapture } from '@/components/Camera/CameraCapture';
import { ModelLoader } from '@/components/LoadingState/ModelLoader';
import { ResultPanel } from '@/components/DetectionResult/ResultPanel';
import { BoundingBoxOverlay } from '@/components/BoundingBoxes/BoundingBoxOverlay';
import { ErrorNotice } from '@/components/common/ErrorNotice';
import { ActionBar, PrimaryButton, SecondaryButton } from '@/components/common/ActionBar';
import { canvasToBlob } from '@/ai/preprocessing/image';
import { isCameraSupported } from '@/utils/camera';
import { OSM_ATTRIBUTION } from '@/utils/reverseGeocode';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { useReportSaver } from '@/hooks/useReportSaver';
import { isStorageConfigured } from '@/services/reports';
import { downloadReport } from '@/utils/reportPdf';
import { LocationBadge, LocationRow } from '@/components/common/LocationBadge';
import { PhotoStamp } from '@/components/common/PhotoStamp';
import { chooseStampPlacement, occlusionFraction } from '@/ai/postprocessing/stampPlacement';
import type { GeoStatus } from '@/types';

const NO_LOCATION: GeoStatus = { stage: 'idle', point: null, error: null, place: null };

type Source = { blob: Blob; url: string; location: GeoStatus } | null;

/**
 * One task per screen.
 *
 * The previous layout stacked chooser, preview and result on a single page,
 * which measured 4.9 phone-screens tall with the verdict 986px down — below the
 * fold, on the only device this is realistically used on. Each state now shows
 * only what is relevant, and the result scrolls itself into view.
 */
export function HomePage() {
  const { status, reload, isReady, imgbbAvailable } = useModel();
  const { state, run, reset, answerClarification } = useAnalysis();
  const saver = useReportSaver();
  const [tab, setTab] = useState<'analyze' | 'reports'>('analyze');
  const [source, setSource] = useState<Source>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const setPreview = useCallback((blob: Blob, location: GeoStatus = NO_LOCATION) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(blob);
    objectUrl.current = url;
    setSource({ blob, url, location });
  }, []);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const clear = useCallback(() => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setSource(null);
    setCameraOpen(false);
    reset();
    saver.reset();
  }, [reset, saver]);

  const result = state.status === 'done' ? state.result : null;
  const busy = state.status === 'running';
  const savedReport = saver.state.status === 'saved' ? saver.state.report : null;

  // Bring the answer into view rather than leaving it below the photo.
  //
  // `behavior: 'smooth'` from JavaScript overrides the `scroll-behavior: auto`
  // that the reduced-motion media query sets in CSS, so the preference has to
  // be honoured here explicitly — for people with vestibular disorders a
  // surprise animated scroll is the exact thing they turned it off to avoid.
  useEffect(() => {
    if (!result) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    resultRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [result]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 sm:px-6">
      {/* Brand band. SIGER leads with the indigo surface and white type. */}
      <header className="-mx-4 bg-[var(--color-brand-surface)] px-4 pb-4 text-center text-white pt-safe sm:-mx-6 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Waste Segregation</h1>
        <p className="mt-1 text-base text-white/85">
          Photograph one item and find out which bin it belongs in.
        </p>
      </header>

      {/* Two destinations only, so tabs beat a router. */}
      <nav
        aria-label="Sections"
        className="-mx-4 flex border-b border-[var(--border)] bg-[var(--surface-raised)] sm:-mx-6"
      >
        {(
          [
            ['analyze', 'Analyze'],
            // Not "My reports" — the board is shared, and a label that claims
            // otherwise misrepresents who can see what was filed.
            ['reports', 'All reports'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={`tap flex-1 px-4 text-sm font-bold uppercase tracking-wide ${
              tab === id
                ? 'border-b-2 border-[var(--color-brand-accent)] text-[var(--color-brand-accent)]'
                : 'border-b-2 border-transparent text-[var(--text-muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'analyze' && (
        <div className="mt-4">
          <ModelLoader status={status} onRetry={() => void reload()} />
        </div>
      )}

      <main className="flex-1 pb-4">
        {tab === 'reports' && (
          <section aria-label="All reports" className="mt-5">
            <Dashboard active={tab === 'reports'} imgbbAvailable={imgbbAvailable} />
          </section>
        )}

        {tab === 'analyze' && (
        <>
        {/* --- Step 1: choose a source ------------------------------------ */}
        {!source && !cameraOpen && (
          <section aria-label="Choose an image" className="mt-5 space-y-3">
            {isCameraSupported() && (
              <PrimaryButton
                onClick={() => setCameraOpen(true)}
                disabled={busy}
                className="w-full !flex-none py-4 text-lg"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
                  <circle cx="12" cy="12.5" r="3.2" />
                </svg>
                Take a photo
              </PrimaryButton>
            )}
            <div className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              or
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <ImageUpload
              disabled={busy}
              onSelect={(file) => {
                setPreview(file);
                reset();
              }}
            />
            <p className="pt-2 text-center text-sm text-[var(--text-muted)]">
              Works best on a single item, filling the frame, in good light.
            </p>
          </section>
        )}

        {/* --- Step 2: camera -------------------------------------------- */}
        {cameraOpen && (
          <section aria-label="Camera" className="mt-5">
            <CameraCapture
              onClose={() => setCameraOpen(false)}
              onCapture={(canvas, location) => {
                void canvasToBlob(canvas).then((blob) => {
                  setPreview(blob, location);
                  reset();
                  setCameraOpen(false);
                });
              }}
            />
          </section>
        )}

        {/* --- Step 3: preview + result ----------------------------------- */}
        {source && (
          <section aria-label="Preview" className="mt-5">
            <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-none bg-black/5 dark:bg-white/5">
              <img
                src={source.url}
                alt="Selected waste item, ready for analysis"
                className={`block h-auto w-auto max-w-full transition-[max-height] ${
                  result ? 'max-h-[32vh]' : 'max-h-[46vh]'
                }`}
              />
              {result && (
                <BoundingBoxOverlay
                  objects={result.objects}
                  imageWidth={result.imageSize.width}
                  imageHeight={result.imageSize.height}
                  activeId={hovered}
                />
              )}
              {/*
                Before analysis there are no boxes to avoid, so the plain badge
                is fine. Once items are detected the stamp is placed on whichever
                edge covers less of them.
              */}
              {source.location.point && result ? (
                (() => {
                  const boxes = result.objects
                    .map((o) => o.box)
                    .filter((b): b is NonNullable<typeof b> => b !== null);
                  const placement = chooseStampPlacement(
                    boxes,
                    result.imageSize.width,
                    result.imageSize.height,
                  );
                  return (
                    <PhotoStamp
                      point={source.location.point}
                      placement={placement}
                      place={source.location.place}
                      occlusion={occlusionFraction(
                        boxes,
                        result.imageSize.width,
                        result.imageSize.height,
                        placement,
                      )}
                    />
                  );
                })()
              ) : (
                <LocationBadge status={source.location} />
              )}
            </div>
            <LocationRow status={source.location} />

            {busy && (
              <p
                aria-live="polite"
                className="mt-5 flex items-center justify-center gap-2 text-base text-[var(--text-muted)]"
              >
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-emerald-500" />
                Analysing your photo…
              </p>
            )}

            {state.status === 'error' && (
              <div className="mt-5">
                <ErrorNotice
                  error={state.error}
                  {...(source ? { onRetry: () => void run(source.blob) } : {})}
                />
              </div>
            )}

            {result && (
              <div ref={resultRef} className="mt-5 scroll-mt-4">
                <ResultPanel
                  result={result}
                  onAnswerClarification={answerClarification}
                  onHoverObject={setHovered}
                />

                {isStorageConfigured(imgbbAvailable) && (
                  <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-4">
                    {savedReport ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="flex-1 text-sm font-semibold text-[var(--color-brand-accent)]">
                          Report saved.
                        </p>
                        <button
                          type="button"
                          onClick={() => void downloadReport(savedReport)}
                          className="tap inline-flex items-center bg-[var(--color-brand-accent)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-accent-hover)]"
                        >
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setTab('reports')}
                          className="tap inline-flex items-center border border-[var(--border)] px-3 text-sm font-semibold"
                        >
                          View all
                        </button>
                      </div>
                    ) : saver.state.status === 'error' ? (
                      <ErrorNotice
                        error={saver.state.error}
                        onRetry={() =>
                          void saver.save(
                            source.blob,
                            result,
                            source.location,
                            source.location.point?.timestamp ?? null,
                            imgbbAvailable,
                          )
                        }
                        retryLabel="Try saving again"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={saver.state.status === 'saving'}
                          onClick={() =>
                            void saver.save(
                              source.blob,
                              result,
                              source.location,
                              source.location.point?.timestamp ?? null,
                              imgbbAvailable,
                            )
                          }
                          className="tap w-full bg-[var(--color-brand-accent)] px-4 text-base font-semibold text-white hover:bg-[var(--color-brand-accent-hover)] disabled:opacity-45"
                        >
                          {saver.state.status === 'saving' ? saver.state.step : 'Save this report'}
                        </button>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                          Saved reports are public: both photos, the verdict, and where and when
                          the photo was taken become visible to everyone using this app.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        </>
        )}

        <footer className="mt-10 border-t border-[var(--border)] pt-5 text-sm leading-relaxed text-[var(--text-muted)]">
          <p>
            A decision aid, not an authority. Answers come from a general-purpose model, not one
            trained on waste, and its stated confidence is a self-report rather than a measured
            probability. For medical, chemical or electronic waste, follow your local rules.
          </p>
          {/* Required by the geocoder's licence wherever its results are shown. */}
          <p className="mt-2">Addresses {OSM_ATTRIBUTION}.</p>
        </footer>
      </main>

      {/* --- Persistent primary action, in the thumb zone ----------------- */}
      {source && !cameraOpen && (
        <ActionBar>
          {result ? (
            <PrimaryButton onClick={clear}>New photo</PrimaryButton>
          ) : (
            <>
              <PrimaryButton onClick={() => void run(source.blob)} disabled={!isReady || busy}>
                {busy ? 'Analysing…' : isReady ? 'Analyze' : 'Not configured'}
              </PrimaryButton>
              <SecondaryButton onClick={clear}>Retake</SecondaryButton>
            </>
          )}
        </ActionBar>
      )}
    </div>
  );
}
