/** The four disposal streams the app can report. */
export type WasteCategory = 'WET' | 'DRY' | 'HAZARDOUS' | 'UNCERTAIN';

/** How much weight to put on a prediction. Derived from score AND margin. */
export type ConfidenceBand = 'high' | 'medium' | 'low';

/** The 12 labels of `dima806/garbage_types_image_detection`, in model order. */
export const WASTE_CLASSES = [
  'battery',
  'biological',
  'brown-glass',
  'cardboard',
  'clothes',
  'green-glass',
  'metal',
  'paper',
  'plastic',
  'shoes',
  'trash',
  'white-glass',
] as const;

export type WasteClass = (typeof WASTE_CLASSES)[number];

/** A single class probability from the classifier's softmax. */
/** An alternative the model considered. NOT a probability distribution. */
export interface Alternative {
  readonly label: WasteClass;
  readonly confidence: number;
}

/** Axis-aligned box in *source image pixel* coordinates (not normalised). */
export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Why a result ended up uncertain, or what the user still needs to check.
 * Surfaced verbatim in the UI — these are the difference between a useful
 * answer and a confidently wrong one.
 */
export interface Caveat {
  readonly code:
    | 'low-score'
    | 'narrow-margin'
    | 'residual-class'
    | 'soiling-unknown'
    | 'soiling-suspected'
    | 'hazardous-handling'
    | 'small-region'
    | 'no-distinct-objects'
    | 'wide-scene';
  readonly message: string;
}

/** A follow-up the UI can ask because the camera physically cannot see it. */
export interface Clarification {
  readonly id: 'soiled';
  readonly question: string;
  readonly yesCategory: WasteCategory;
  readonly noCategory: WasteCategory;
}

/** One analysed item: either a detected region, or the whole frame. */
export interface AnalyzedObject {
  readonly id: string;
  /** Absent when the detector found nothing and we classified the whole frame. */
  readonly box: BoundingBox | null;
  readonly alternatives: readonly Alternative[];
  /** What the model called it, e.g. "banana peel". */
  readonly itemName: string;
  /** The material class the disposal rule was keyed on. */
  readonly material: WasteClass;
  readonly category: WasteCategory;
  /** Model softmax probability of the winning class. NOT measured accuracy. */
  readonly confidence: number;
  readonly band: ConfidenceBand;
  readonly caveats: readonly Caveat[];
  readonly clarification: Clarification | null;
  /** Human-readable disposal guidance. */
  readonly recommendation: string;
}

export interface CategoryTally {
  readonly WET: number;
  readonly DRY: number;
  readonly HAZARDOUS: number;
  readonly UNCERTAIN: number;
}

export interface AnalysisSummary {
  readonly tally: CategoryTally;
  readonly mixed: boolean;
  readonly headline: string;
  readonly recommendation: string;
}

export interface AnalysisTimings {
  readonly requestMs: number;
  readonly totalMs: number;
}

export interface AnalysisResult {
  readonly objects: readonly AnalyzedObject[];
  readonly summary: AnalysisSummary;
  readonly imageSize: { width: number; height: number };
  readonly timings: AnalysisTimings;
  /** What kind of photograph the model judged this to be. */
  readonly scene: 'single-item' | 'few-items' | 'pile-or-scene';
  readonly engineId: string;
}

/** Where a photo was taken. Only ever captured from the live camera. */
export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
  /** Radius of 68% confidence, in metres, as reported by the device. */
  readonly accuracy: number;
  /** Epoch ms of the fix, which is not necessarily when the photo was taken. */
  readonly timestamp: number;
}

export type GeoStage = 'idle' | 'locating' | 'ready' | 'error' | 'unsupported';

export interface GeoStatus {
  readonly stage: GeoStage;
  readonly point: GeoPoint | null;
  readonly error: AppError | null;
  /** Resolved address, when the lookup succeeded. Never blocks the fix. */
  readonly place: { region: string; detail: string } | null;
}

export type EngineStage = 'idle' | 'checking' | 'ready' | 'error';

/**
 * Engine readiness.
 *
 * With a hosted API there is nothing to download, so this collapses to a
 * configuration check — is a key present and usable — rather than the
 * multi-megabyte progress bar the on-device model needed.
 */
export interface EngineStatus {
  readonly stage: EngineStage;
  readonly message: string;
  readonly error: AppError | null;
}

export type AppErrorCode =
  | 'API_KEY_MISSING'
  | 'API_KEY_INVALID'
  | 'API_RATE_LIMITED'
  | 'API_UNAVAILABLE'
  | 'API_UNREACHABLE'
  | 'API_TIMEOUT'
  | 'INFERENCE_FAILED'
  | 'UNSUPPORTED_BROWSER'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_NOT_FOUND'
  | 'CAMERA_IN_USE'
  | 'CAMERA_CONSTRAINTS'
  | 'CAMERA_INSECURE_CONTEXT'
  | 'CAMERA_UNKNOWN'
  | 'LOCATION_PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'LOCATION_TIMEOUT'
  | 'LOCATION_UNSUPPORTED'
  | 'GEOCODE_FAILED'
  | 'UPLOAD_FAILED'
  | 'REPORT_SAVE_FAILED'
  | 'REPORT_FETCH_FAILED'
  | 'REPORT_DELETE_FAILED'
  | 'REPORT_DOWNLOAD_FAILED'
  | 'STORAGE_NOT_CONFIGURED'
  | 'FILE_TYPE_INVALID'
  | 'FILE_TOO_LARGE'
  | 'IMAGE_TOO_SMALL'
  | 'IMAGE_DECODE_FAILED';

/** User-facing error. `message` is plain language; `detail` is for the console. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly hint: string | undefined;
  readonly detail: string | undefined;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { hint?: string; detail?: string; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.hint = options?.hint;
    this.detail = options?.detail;
  }
}
