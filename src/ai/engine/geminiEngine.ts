import { DETECTION, GEMINI } from '@/config';
import { analyzeImageWithFallback, type GeminiItem } from '@/ai/gemini/client';
import { getApiKey } from '@/ai/gemini/apiKey';
import { canvasToBlob, type PreparedImage } from '@/ai/preprocessing/image';
import { clampToImage, iou } from '@/ai/postprocessing/boxes';
import { classifyObject, isSmallRegion, summarize } from '@/ai/wasteRules';
import {
  AppError,
  type AnalysisResult,
  type AnalyzedObject,
  type BoundingBox,
  type EngineStatus,
} from '@/types';
import type { AnalyzeOptions, InferenceEngine } from './types';

/** Strip the `data:image/jpeg;base64,` prefix the API does not want. */
function toBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function encode(image: PreparedImage): Promise<{ base64: string; mimeType: string }> {
  const blob = await canvasToBlob(image.canvas, 'image/jpeg', GEMINI.JPEG_QUALITY);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
  return { base64: toBase64(dataUrl), mimeType: 'image/jpeg' };
}

/**
 * Convert Gemini's `[ymin, xmin, ymax, xmax]` at 0-1000 into source pixels.
 *
 * The ordering is y-first and the scale is fixed at 1000 regardless of the
 * image's real size, so both have to be undone explicitly. Getting either wrong
 * produces boxes that look plausible and sit in the wrong place.
 */
export function toBox(
  box2d: readonly number[],
  width: number,
  height: number,
): BoundingBox | null {
  if (box2d.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box2d as [number, number, number, number];
  const x = (xmin / 1000) * width;
  const y = (ymin / 1000) * height;
  const w = ((xmax - xmin) / 1000) * width;
  const h = ((ymax - ymin) / 1000) * height;
  if (!(w > 0) || !(h > 0)) return null;
  return clampToImage({ x, y, width: w, height: h }, width, height);
}

export class GeminiEngine implements InferenceEngine {
  readonly id = 'gemini';
  readonly displayName = `Google Gemini (${GEMINI.MODEL})`;
  /**
   * False, and load-bearing. The UI reads this to decide what to tell the user
   * about where their photograph goes. It must never be true for an engine that
   * uploads images.
   */
  readonly isLocal = false;

  prepare(onStatus?: (s: EngineStatus) => void): Promise<void> {
    onStatus?.({ stage: 'checking', message: 'Checking Gemini configuration…', error: null });
    try {
      getApiKey();
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError('API_KEY_MISSING', 'Gemini is not configured.', { cause: error });
      onStatus?.({ stage: 'error', message: appError.message, error: appError });
      return Promise.reject(appError);
    }
    onStatus?.({
      stage: 'ready',
      // Names the model that will be *tried* first. When capacity forces a
      // fallback, the result panel and the report both say which model actually
      // answered, so the two never silently disagree.
      message: `Ready — ${GEMINI.MODEL}`,
      error: null,
    });
    return Promise.resolve();
  }

  async analyze(image: PreparedImage, options: AnalyzeOptions = {}): Promise<AnalysisResult> {
    const started = performance.now();
    const apiKey = getApiKey();
    const { base64, mimeType } = await encode(image);
    options.signal?.throwIfAborted();

    const requestStart = performance.now();
    const result = await analyzeImageWithFallback(base64, mimeType, apiKey, options.signal);
    const requestMs = performance.now() - requestStart;

    const wideScene = result.scene === 'pile-or-scene';

    const withBoxes = result.items
      .filter((i) => i.confidence >= DETECTION.MIN_ITEM_CONFIDENCE)
      .map((item) => ({ item, box: toBox(item.box_2d, image.sourceWidth, image.sourceHeight) }))
      .sort((a, b) => b.item.confidence - a.item.confidence);

    // Drop repeats. Observed live: one banana peel reported twice as two
    // overlapping items, which would otherwise be counted twice in the summary
    // and drawn as two boxes over the same object. Highest confidence wins.
    const kept: { item: GeminiItem; box: BoundingBox | null }[] = [];
    for (const candidate of withBoxes) {
      const duplicate = kept.some(
        (k) => k.box && candidate.box && iou(k.box, candidate.box) >= GEMINI.DEDUP_IOU,
      );
      if (!duplicate) kept.push(candidate);
    }
    const usable = kept.slice(0, DETECTION.MAX_OBJECTS);

    const objects: AnalyzedObject[] = usable.map(({ item, box }, i) =>
      classifyObject({
        id: `item-${i}`,
        itemName: item.name,
        material: item.material,
        confidence: item.confidence,
        soiled: item.soiled,
        box,
        smallRegion: isSmallRegion(box, image.sourceWidth, image.sourceHeight),
        wideScene,
      }),
    );

    return {
      objects,
      summary: summarize(objects),
      imageSize: { width: image.sourceWidth, height: image.sourceHeight },
      timings: { requestMs: Math.round(requestMs), totalMs: Math.round(performance.now() - started) },
      scene: result.scene,
      engineId: result.model,
    };
  }
}
