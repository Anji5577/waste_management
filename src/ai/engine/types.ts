import type { AnalysisResult, EngineStatus } from '@/types';
import type { PreparedImage } from '@/ai/preprocessing/image';

export interface AnalyzeOptions {
  readonly signal?: AbortSignal;
}

/**
 * The boundary between the UI and whatever is doing the thinking.
 *
 * Everything in `src/components` talks to this interface and nothing else. That
 * is what allowed the on-device ONNX pipeline to be replaced by a hosted API
 * without a single component changing shape.
 *
 * `isLocal` drives the data-handling notice the UI shows. It is false here, and
 * the UI says so plainly — an app that sends photographs to a third party must
 * not display the assurance that it doesn't.
 */
export interface InferenceEngine {
  readonly id: string;
  readonly displayName: string;
  readonly isLocal: boolean;

  /** Verify the engine is usable. Cheap; safe to call repeatedly. */
  prepare(onStatus?: (s: EngineStatus) => void): Promise<void>;
  analyze(image: PreparedImage, options?: AnalyzeOptions): Promise<AnalysisResult>;
}
