import { STORAGE } from '@/config';
import { AppError, type AnalysisResult, type GeoStatus } from '@/types';

/**
 * Report persistence over Supabase's PostgREST endpoint.
 *
 * Deliberately a thin fetch wrapper rather than @supabase/supabase-js: the app
 * needs one insert and one select, has no auth, and no realtime. Pulling in the
 * SDK for that would add far more bundle than it saves in code.
 */

export interface StoredReport {
  readonly id: string;
  readonly created_at: string;
  readonly device_id: string;
  readonly original_url: string;
  readonly analyzed_url: string | null;
  /** ImgBB's own delete PAGE, not an API. Only a person can action it. */
  readonly delete_url: string | null;
  readonly summary_headline: string;
  readonly summary_action: string | null;
  readonly tally: Record<string, number>;
  readonly items: readonly StoredItem[];
  readonly scene: string | null;
  readonly model: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accuracy_m: number | null;
  readonly place_region: string | null;
  readonly place_detail: string | null;
  readonly taken_at: string | null;
}

export interface StoredItem {
  readonly name: string;
  readonly material: string;
  readonly category: string;
  readonly confidence: number;
}

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

/**
 * What is still missing before reports can be saved.
 *
 * Returns the specific variables rather than a bare boolean. The previous
 * message named all three every time and named the wrong one for the image
 * host — it still said `VITE_IMGBB_API_KEY` after that key moved server-side,
 * so following the instruction exactly would not have fixed anything.
 */
export function missingStorageConfig(imgbbAvailable: boolean): string[] {
  const missing: string[] = [];
  if (!imgbbAvailable) missing.push('IMGBB_API_KEY (server-side, no VITE_ prefix)');
  if (!(import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  return missing;
}

export function isStorageConfigured(imgbbAvailable: boolean): boolean {
  return missingStorageConfig(imgbbAvailable).length === 0;
}

/** Advice that names the actual gap, and where to set it. */
export function storageHint(imgbbAvailable: boolean): string {
  const missing = missingStorageConfig(imgbbAvailable);
  if (missing.length === 0) return '';
  const where = import.meta.env.DEV
    ? 'in .env, then restart the dev server'
    : 'in your deployment’s environment variables, then redeploy';
  return `Still to set: ${missing.join(', ')} — ${where}.`;
}

/**
 * A stable per-browser id.
 *
 * Reports are a public board — everyone sees everything — so this no longer
 * filters the dashboard. It is kept because it still answers "did I file this?",
 * which is what decides whether the delete control appears on a card.
 *
 * Explicitly NOT a security boundary: with no sign-in, RLS cannot tell one
 * anonymous caller from another, so the database will hand any row to anyone
 * holding the publishable key. The ownership check is a courtesy in the
 * interface, not a rule the database enforces.
 */
export function getDeviceId(): string {
  const KEY = 'siger.device-id';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode with storage blocked: reports still save, they just will not
    // be grouped on a later visit.
    return 'ephemeral';
  }
}

function headers(cfg: SupabaseConfig, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: cfg.anonKey,
    Authorization: `Bearer ${cfg.anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function schemaError(detail: string): AppError {
  return new AppError('REPORT_SAVE_FAILED', 'The reports table is missing.', {
    hint: 'Run supabase/001_reports.sql in the Supabase SQL editor, then try again.',
    detail,
  });
}

export interface NewReport {
  readonly result: AnalysisResult;
  readonly location: GeoStatus;
  readonly originalUrl: string;
  readonly analyzedUrl: string | null;
  readonly deleteUrl: string | null;
  readonly takenAt: number | null;
}

export async function saveReport(report: NewReport): Promise<StoredReport> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new AppError('STORAGE_NOT_CONFIGURED', 'Report saving is not configured.', {
      hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    });
  }

  const { result, location } = report;
  const row = {
    device_id: getDeviceId(),
    original_url: report.originalUrl,
    analyzed_url: report.analyzedUrl,
    delete_url: report.deleteUrl,
    summary_headline: result.summary.headline,
    summary_action: result.summary.recommendation,
    tally: result.summary.tally,
    items: result.objects.map((o) => ({
      name: o.itemName,
      material: o.material,
      category: o.category,
      confidence: o.confidence,
    })),
    scene: result.scene,
    model: result.engineId,
    latitude: location.point?.latitude ?? null,
    longitude: location.point?.longitude ?? null,
    accuracy_m: location.point?.accuracy ?? null,
    place_region: location.place?.region ?? null,
    place_detail: location.place?.detail ?? null,
    taken_at: report.takenAt ? new Date(report.takenAt).toISOString() : null,
  };

  const response = await fetch(`${cfg.url}/rest/v1/reports`, {
    method: 'POST',
    headers: headers(cfg, { Prefer: 'return=representation' }),
    body: JSON.stringify(row),
  }).catch((cause: unknown) => {
    throw new AppError('REPORT_SAVE_FAILED', 'The report could not be saved.', {
      hint: 'Check your connection. The analysis itself is unaffected.',
      cause,
    });
  });

  const body = (await response.json().catch(() => null)) as
    | StoredReport[]
    | { message?: string; code?: string }
    | null;

  if (!response.ok) {
    const err = body as { message?: string; code?: string } | null;
    if (err?.code === 'PGRST205') throw schemaError(err.message ?? 'table not found');
    throw new AppError('REPORT_SAVE_FAILED', 'The database rejected the report.', {
      hint:
        response.status === 401 || response.status === 403
          ? 'Check VITE_SUPABASE_ANON_KEY, and that the RLS insert policy exists.'
          : 'Try again in a moment.',
      detail: `HTTP ${response.status}: ${err?.message ?? response.statusText}`,
    });
  }

  const rows = body as StoredReport[];
  const saved = rows[0];
  if (!saved) {
    throw new AppError('REPORT_SAVE_FAILED', 'The report was not returned after saving.', {
      hint: 'Check the table has a `return=representation` compatible schema.',
    });
  }
  return saved;
}

/**
 * Every report, most recent first.
 *
 * Deliberately unfiltered: this is a shared record of what has been found and
 * where, so a report filed on one phone is visible from every other.
 */
export async function listReports(limit = STORAGE.PAGE_SIZE): Promise<StoredReport[]> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new AppError('STORAGE_NOT_CONFIGURED', 'Report saving is not configured.', {
      hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    });
  }

  const query =
    `${cfg.url}/rest/v1/reports?select=*&order=created_at.desc&limit=${limit}`;

  const response = await fetch(query, { headers: headers(cfg) }).catch((cause: unknown) => {
    throw new AppError('REPORT_FETCH_FAILED', 'Saved reports could not be loaded.', {
      hint: 'Check your connection.',
      cause,
    });
  });

  const body = (await response.json().catch(() => null)) as
    | StoredReport[]
    | { message?: string; code?: string }
    | null;

  if (!response.ok) {
    const err = body as { message?: string; code?: string } | null;
    if (err?.code === 'PGRST205') throw schemaError(err.message ?? 'table not found');
    throw new AppError('REPORT_FETCH_FAILED', 'Saved reports could not be loaded.', {
      hint: 'Check the RLS select policy exists for the anon role.',
      detail: `HTTP ${response.status}: ${err?.message ?? response.statusText}`,
    });
  }

  return (body as StoredReport[]) ?? [];
}

/**
 * Remove a report.
 *
 * Deletes the database row only. The images stay on ImgBB: its delete URL is a
 * web page a person has to visit, not an endpoint this app can call, so
 * promising to remove them would be a lie. The dashboard hands the user that
 * link instead of pretending the images are gone.
 */
export async function deleteReport(id: string): Promise<void> {
  const cfg = getSupabaseConfig();
  if (!cfg) {
    throw new AppError('STORAGE_NOT_CONFIGURED', 'Report storage is not configured.', {
      hint: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
    });
  }

  // `return=representation` is load-bearing, not a nicety. A DELETE that RLS
  // silently filters to zero rows still answers 204 — verified against the live
  // database before the delete policy existed. Without asking for the deleted
  // rows back, the app would report success while deleting nothing.
  const response = await fetch(
    `${cfg.url}/rest/v1/reports?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: headers(cfg, { Prefer: 'return=representation' }) },
  ).catch((cause: unknown) => {
    throw new AppError('REPORT_DELETE_FAILED', 'The report could not be deleted.', {
      hint: 'Check your connection and try again.',
      cause,
    });
  });

  const body = (await response.json().catch(() => null)) as
    | { id?: string }[]
    | { message?: string }
    | null;

  if (!response.ok) {
    const err = body as { message?: string } | null;
    throw new AppError('REPORT_DELETE_FAILED', 'The database refused to delete the report.', {
      hint:
        response.status === 401 || response.status === 403
          ? 'Run supabase/002_report_delete.sql to add the delete policy.'
          : 'Try again in a moment.',
      detail: `HTTP ${response.status}: ${err?.message ?? response.statusText}`,
    });
  }

  if (!Array.isArray(body) || body.length === 0) {
    throw new AppError('REPORT_DELETE_FAILED', 'Nothing was deleted.', {
      hint: 'Run supabase/002_report_delete.sql in the Supabase SQL editor to allow deletes.',
      detail: 'DELETE matched 0 rows — the row-level security policy blocked it.',
    });
  }
}
