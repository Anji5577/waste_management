import { AppError, type GeoPoint } from '@/types';

/**
 * How long to wait for a fix before giving up.
 *
 * A cold GPS fix outdoors can genuinely take 15-20 s, and this runs while the
 * user is standing in the street pointing a phone at a rubbish heap. Failing
 * early would mean reporting no location precisely when it matters most.
 */
const TIMEOUT_MS = 20_000;

/** Accept a cached fix this recent rather than waking the GPS again. */
const MAX_AGE_MS = 30_000;

export function isGeolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Geolocation, like getUserMedia, silently requires a secure context. Without
 * this check the user sees a bare permission failure on http:// with no clue why.
 */
export function isSecureContextForLocation(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function toLocationError(error: unknown): AppError {
  const code = (error as GeolocationPositionError | undefined)?.code;
  const detail =
    error instanceof Error || (error as GeolocationPositionError)?.message
      ? `${String(code ?? '')} ${(error as GeolocationPositionError).message}`.trim()
      : String(error);

  switch (code) {
    case 1: // PERMISSION_DENIED
      return new AppError('LOCATION_PERMISSION_DENIED', 'Location access was blocked.', {
        hint: 'Allow location for this site in your browser’s address-bar permissions. The photo still works without it.',
        detail,
      });
    case 2: // POSITION_UNAVAILABLE
      return new AppError('LOCATION_UNAVAILABLE', 'Your location could not be determined.', {
        hint: 'Move somewhere with a clearer view of the sky, or turn on device location services.',
        detail,
      });
    case 3: // TIMEOUT
      return new AppError('LOCATION_TIMEOUT', 'Getting a location fix took too long.', {
        hint: 'Try again outdoors, where GPS works better.',
        detail,
      });
    default:
      return new AppError('LOCATION_UNAVAILABLE', 'Your location could not be determined.', {
        hint: 'The photo still works without it.',
        detail,
      });
  }
}

/**
 * Read the current position.
 *
 * `enableHighAccuracy` is on because the point of this is identifying *which*
 * rubbish heap — a 2 km network-derived fix would name the wrong street.
 */
export function getPosition(): Promise<GeoPoint> {
  if (!isGeolocationSupported()) {
    return Promise.reject(
      new AppError('LOCATION_UNSUPPORTED', 'This browser cannot report a location.', {
        hint: 'The photo still works without it.',
      }),
    );
  }
  if (!isSecureContextForLocation()) {
    return Promise.reject(
      new AppError('LOCATION_UNSUPPORTED', 'Location needs a secure connection.', {
        hint: 'Open this site over HTTPS (or on localhost) to record where a photo was taken.',
      }),
    );
  }

  return new Promise<GeoPoint>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }),
      (err) => reject(toLocationError(err)),
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS },
    );
  });
}

/** Six decimal places ≈ 0.1 m — past the precision any phone actually has. */
export function formatCoords(point: GeoPoint): string {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

export function formatAccuracy(point: GeoPoint): string {
  return `±${point.accuracy < 10 ? point.accuracy.toFixed(0) : Math.round(point.accuracy)} m`;
}

/**
 * `02/11/24 04:37 PM GMT+05:30` — the format GPS-camera apps stamp, kept because
 * it is what municipal officers are used to reading on a dumping report.
 */
export function formatStampTime(timestamp: number): string {
  const d = new Date(timestamp);
  const p2 = (n: number) => String(n).padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;

  // getTimezoneOffset is minutes *behind* UTC, so the sign is inverted.
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const zone = `GMT${sign}${p2(Math.floor(Math.abs(off) / 60))}:${p2(Math.abs(off) % 60)}`;

  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p2(h)}:${p2(d.getMinutes())} ${ampm} ${zone}`;
}

/** Stamp-style coordinates: `Lat 16.353146°  Long 81.046527°`. */
export function formatStampCoords(point: GeoPoint): string {
  return `Lat ${point.latitude.toFixed(6)}°  Long ${point.longitude.toFixed(6)}°`;
}

/** A `geo:` URI opens the device's own map app; the web fallback is a URL. */
export function mapsUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
}
