import type { GeoPoint } from '@/types';
import type { StampPlacement } from '@/ai/postprocessing/stampPlacement';
import { formatAccuracy, formatStampCoords, formatStampTime } from '@/utils/geolocation';

interface Props {
  point: GeoPoint;
  placement: StampPlacement;
  /** Resolved address, when the lookup succeeded. */
  place?: { region: string; detail: string } | null;
  /** 0-1 share of detected-item area the panel still covers. */
  occlusion?: number;
}

/**
 * A GPS-camera style stamp, placed so it does not bury the findings.
 *
 * Two departures from the apps this imitates, both deliberate:
 *
 * 1. It is not pinned to the bottom. Waste sits on the ground, so the bottom
 *    strip is exactly where the detected items are; the edge is chosen by
 *    measuring which one covers less. See `chooseStampPlacement`.
 * 2. The address comes from OpenStreetMap and only renders once it has actually
 *    resolved. Nothing is inferred locally: on a dumping report the street name
 *    is evidence, and a plausible-looking guess would be worse than none.
 */
export function PhotoStamp({ point, placement, place = null, occlusion = 0 }: Props) {
  return (
    <figcaption
      className={`absolute inset-x-0 ${placement === 'top' ? 'top-0' : 'bottom-0'} z-10`}
    >
      <div
        className={`flex items-center gap-3 bg-black/62 px-3 py-2 text-white backdrop-blur-sm ${
          placement === 'top' ? 'pb-2.5' : 'pt-2.5'
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-6 shrink-0 text-white/90"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
        <div className="min-w-0 flex-1 leading-snug">
          {place && (
            <>
              <p className="text-sm font-bold sm:text-base">{place.region}</p>
              {place.detail && place.detail !== place.region && (
                <p className="text-[12px] text-white/90 sm:text-sm">{place.detail}</p>
              )}
            </>
          )}
          <p className="font-mono text-[12px] font-semibold tabular-nums sm:text-[13px]">
            {formatStampCoords(point)}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-white/85">
            {formatStampTime(point.timestamp)} · {formatAccuracy(point)}
          </p>
        </div>
      </div>
      {occlusion > 0.15 && (
        <p
          className={`bg-amber-500/90 px-3 py-1 text-[11px] font-semibold text-black ${
            placement === 'top' ? '' : 'order-first'
          }`}
        >
          The stamp covers part of a detected item — see the list below.
        </p>
      )}
    </figcaption>
  );
}
