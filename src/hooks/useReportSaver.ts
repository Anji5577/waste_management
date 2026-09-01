import { useCallback, useRef, useState } from 'react';
import { uploadImage } from '@/services/imgbb';
import { getImgbbKey, isStorageConfigured, saveReport, type StoredReport } from '@/services/reports';
import { renderAnalyzedImage } from '@/utils/renderAnalyzedImage';
import { AppError, type AnalysisResult, type GeoStatus } from '@/types';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving'; step: string }
  | { status: 'saved'; report: StoredReport }
  | { status: 'error'; error: AppError };

/**
 * Files a report: both images to the image host, the verdict to the database.
 *
 * Ordering matters. The original is uploaded first so that a failure while
 * compositing the annotated version still leaves a usable record, and the
 * database row is written last so it never references an image that does not
 * exist.
 *
 * Nothing here is on the critical path — the analysis has already been shown by
 * the time this runs, and every failure is reported without disturbing it.
 */
export function useReportSaver() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const inFlight = useRef(false);

  const save = useCallback(
    async (source: Blob, result: AnalysisResult, location: GeoStatus, takenAt: number | null) => {
      if (inFlight.current) return;
      if (!isStorageConfigured()) {
        setState({
          status: 'error',
          error: new AppError('STORAGE_NOT_CONFIGURED', 'Report saving is not configured.', {
            hint: 'Set VITE_IMGBB_API_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
          }),
        });
        return;
      }

      inFlight.current = true;
      const imgbbKey = getImgbbKey()!;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

      try {
        setState({ status: 'saving', step: 'Uploading the original photo…' });
        const original = await uploadImage(source, `waste-${stamp}-original`, imgbbKey);

        setState({ status: 'saving', step: 'Drawing the analysis onto the photo…' });
        let analyzedUrl: string | null = null;
        try {
          const annotated = await renderAnalyzedImage(source, result.objects, location);
          setState({ status: 'saving', step: 'Uploading the analysed photo…' });
          analyzedUrl = (await uploadImage(annotated, `waste-${stamp}-analyzed`, imgbbKey)).url;
        } catch {
          // A failed composite must not cost the whole report. The original and
          // the verdict are still worth keeping.
          analyzedUrl = null;
        }

        setState({ status: 'saving', step: 'Saving the report…' });
        const report = await saveReport({
          result,
          location,
          originalUrl: original.url,
          analyzedUrl,
          deleteUrl: original.deleteUrl,
          takenAt,
        });

        setState({ status: 'saved', report });
      } catch (error) {
        setState({
          status: 'error',
          error:
            error instanceof AppError
              ? error
              : new AppError('REPORT_SAVE_FAILED', 'The report could not be saved.', {
                  hint: 'The analysis above is unaffected.',
                  cause: error,
                }),
        });
      } finally {
        inFlight.current = false;
      }
    },
    [],
  );

  const reset = useCallback(() => setState({ status: 'idle' }), []);
  return { state, save, reset };
}
