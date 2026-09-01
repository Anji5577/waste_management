import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition, isGeolocationSupported, isSecureContextForLocation } from '@/utils/geolocation';
import { reverseGeocode } from '@/utils/reverseGeocode';
import { AppError, type GeoStatus } from '@/types';

const IDLE: GeoStatus = { stage: 'idle', point: null, error: null, place: null };

/**
 * Location for the current capture.
 *
 * Deliberately non-blocking: a fix can take 20 seconds, and a photo that was
 * taken is worth more than a photo that was missed while waiting for GPS. The
 * request starts when the camera opens so it is usually resolved by the time
 * the shutter is pressed, and capture never waits on it.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>(IDLE);
  const mounted = useRef(true);
  const inFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback(() => {
    if (!isGeolocationSupported() || !isSecureContextForLocation()) {
      setStatus({
        stage: 'unsupported',
        point: null,
        place: null,
        error: new AppError('LOCATION_UNSUPPORTED', 'Location is unavailable here.', {
          hint: isGeolocationSupported()
            ? 'Location needs HTTPS. The photo still works without it.'
            : 'This browser cannot report a location. The photo still works without it.',
        }),
      });
      return inFlight.current ?? Promise.resolve();
    }

    setStatus({ stage: 'locating', point: null, error: null, place: null });
    const p = getPosition()
      .then(async (point) => {
        // Show the fix immediately; the address is a separate network call and
        // must never hold up the coordinates or the shutter.
        if (mounted.current) setStatus({ stage: 'ready', point, error: null, place: null });
        try {
          const place = await reverseGeocode(point);
          if (mounted.current) setStatus({ stage: 'ready', point, error: null, place });
        } catch {
          // Address lookup is best-effort. Coordinates alone are still a valid
          // record, so a failure here is deliberately silent on the badge.
        }
      })
      .catch((error: unknown) => {
        if (!mounted.current) return;
        setStatus({
          stage: 'error',
          point: null,
          place: null,
          error:
            error instanceof AppError
              ? error
              : new AppError('LOCATION_UNAVAILABLE', 'Your location could not be determined.'),
        });
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = p;
    return p;
  }, []);

  const reset = useCallback(() => setStatus(IDLE), []);

  return { status, request, reset };
}
