import { useCallback, useRef, useState } from 'react';
import { getEngine } from '@/ai/engine';
import { decodeImage, prepareImage, type PreparedImage } from '@/ai/preprocessing/image';
import { applyClarification } from '@/ai/wasteRules';
import { summarize } from '@/ai/wasteRules/summarize';
import { AppError, type AnalysisResult } from '@/types';

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: AnalysisResult }
  | { status: 'error'; error: AppError };

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({ status: 'idle' });
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (source: Blob | HTMLVideoElement | HTMLCanvasElement) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setState({ status: 'running' });

    try {
      const prepared: PreparedImage =
        source instanceof Blob ? prepareImage(await decodeImage(source)) : prepareImage(source);
      const result = await getEngine().analyze(prepared, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setState({ status: 'done', result });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState({
        status: 'error',
        error:
          error instanceof AppError
            ? error
            : new AppError('INFERENCE_FAILED', 'The image could not be analysed.', {
                hint: 'Try again with a different photo.',
                detail: error instanceof Error ? error.message : String(error),
                cause: error,
              }),
      });
    }
  }, []);

  /** Fold the user's answer to the soiling question back into the result. */
  const answerClarification = useCallback((objectId: string, soiled: boolean) => {
    setState((prev) => {
      if (prev.status !== 'done') return prev;
      const objects = prev.result.objects.map((o) =>
        o.id === objectId ? applyClarification(o, soiled) : o,
      );
      return {
        status: 'done',
        result: { ...prev.result, objects, summary: summarize(objects) },
      };
    });
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, run, reset, answerClarification };
}
