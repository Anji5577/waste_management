import type { GeoStatus } from '@/types';
import { formatAccuracy, formatCoords, mapsUrl } from '@/utils/geolocation';

/**
 * Where the photo was taken, laid over the bottom of the image.
 *
 * Sits on the photo rather than beside it because the pairing is the point:
 * a heap and the coordinates of that heap are one piece of evidence, and
 * separating them invites them being read apart.
 */
export function LocationBadge({ status }: { status: GeoStatus }) {
  if (status.stage === 'idle') return null;

  // Wraps rather than truncates. The preview shrinks once a result is shown,
  // and clipping a coordinate to "17.385044, …" turns a precise location into
  // an ambiguous one — the opposite of the point.
  const base =
    'absolute inset-x-0 bottom-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-gradient-to-t from-black/85 to-black/0 px-3 pb-2 pt-6 text-white';

  if (status.stage === 'locating') {
    return (
      <p className={`${base} text-sm`} aria-live="polite">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-white/80" />
        Finding location…
      </p>
    );
  }

  if (status.point) {
    return (
      <div className={base}>
        <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0 self-center" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <span className="min-w-0 leading-snug">
          {status.place && (
            <span className="block text-sm font-semibold">{status.place.region}</span>
          )}
          <span className="block font-mono text-[13px] tabular-nums">
            {formatCoords(status.point)}
          </span>
        </span>
        <span className="text-xs text-white/75">{formatAccuracy(status.point)}</span>
      </div>
    );
  }

  // Denied, timed out, or unsupported. Stated plainly and never blocking —
  // a photo without coordinates is still a usable photo.
  return (
    <p className={`${base} text-sm text-white/85`}>
      <svg aria-hidden viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <path strokeLinecap="round" d="m4 4 16 16" />
      </svg>
      No location recorded
    </p>
  );
}

/** The same fix, as an actionable row beneath the photo. */
export function LocationRow({ status }: { status: GeoStatus }) {
  if (!status.point) {
    if (status.stage === 'error' && status.error) {
      return (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {status.error.message} {status.error.hint}
        </p>
      );
    }
    return null;
  }

  const point = status.point;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-[var(--text-muted)]">
        Taken at{' '}
        <span className="font-mono tabular-nums text-[var(--text)]">{formatCoords(point)}</span>{' '}
        ({formatAccuracy(point)})
      </span>
      <a
        href={mapsUrl(point)}
        target="_blank"
        rel="noreferrer noopener"
        className="tap inline-flex items-center font-semibold underline underline-offset-4"
      >
        Open in Maps
      </a>
    </div>
  );
}
