import { ACTIVE_ENGINE } from '@/config';
import { GeminiEngine } from './geminiEngine';
import type { InferenceEngine } from './types';

/**
 * Engine registry.
 *
 * This seam is why replacing the on-device ONNX pipeline with a hosted API
 * touched `src/ai/` and the data-handling notice, and nothing else — no
 * component, hook or rule changed shape.
 */
const engines: Record<string, () => InferenceEngine> = {
  gemini: () => new GeminiEngine(),
};

let current: InferenceEngine | null = null;

export function getEngine(): InferenceEngine {
  if (!current) {
    const factory = engines[ACTIVE_ENGINE];
    if (!factory) throw new Error(`Unknown inference engine: ${ACTIVE_ENGINE}`);
    current = factory();
  }
  return current;
}

/** Test seam. */
export function __setEngine(engine: InferenceEngine | null): void {
  current = engine;
}
