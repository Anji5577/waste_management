import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, type GeoPoint } from '@/types';
import {
  formatAccuracy,
  formatCoords,
  getPosition,
  isGeolocationSupported,
  mapsUrl,
  toLocationError,
} from './geolocation';

const point: GeoPoint = {
  latitude: 17.385044,
  longitude: 78.486671,
  accuracy: 12.4,
  timestamp: 1_700_000_000_000,
};

function positionError(code: number): GeolocationPositionError {
  return { code, message: 'nope', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}

afterEach(() => vi.unstubAllGlobals());

describe('toLocationError', () => {
  it.each([
    [1, 'LOCATION_PERMISSION_DENIED'],
    [2, 'LOCATION_UNAVAILABLE'],
    [3, 'LOCATION_TIMEOUT'],
  ])('maps GeolocationPositionError code %s to %s', (code, expected) => {
    expect(toLocationError(positionError(code)).code).toBe(expected);
  });

  it('falls back for an unrecognised failure', () => {
    expect(toLocationError(new Error('weird')).code).toBe('LOCATION_UNAVAILABLE');
  });

  it('always says the photo still works without a location', () => {
    // Losing GPS must never read as losing the feature.
    for (const code of [1, 2, 3]) {
      const err = toLocationError(positionError(code));
      expect(err.hint).toBeTruthy();
    }
    expect(toLocationError(positionError(1)).hint).toMatch(/still works without it/i);
  });

  it('never surfaces the raw DOM code in user-facing text', () => {
    const err = toLocationError(positionError(1));
    expect(err.message).toBe('Location access was blocked.');
    expect(err.detail).toContain('1');
  });
});

describe('formatting', () => {
  it('renders six decimal places — past any phone’s real precision', () => {
    expect(formatCoords(point)).toBe('17.385044, 78.486671');
  });

  it('renders accuracy as a radius', () => {
    expect(formatAccuracy(point)).toBe('±12 m');
    expect(formatAccuracy({ ...point, accuracy: 4.6 })).toBe('±5 m');
  });

  it('builds a maps link containing the exact coordinates', () => {
    expect(mapsUrl(point)).toContain('17.385044,78.486671');
  });
});

describe('getPosition', () => {
  it('resolves the fields the app records, and nothing more', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({
            coords: { latitude: 1.5, longitude: 2.5, accuracy: 8, altitude: 100, speed: 3 },
            timestamp: 123,
          }),
      },
    });
    await expect(getPosition()).resolves.toEqual({
      latitude: 1.5,
      longitude: 2.5,
      accuracy: 8,
      timestamp: 123,
    });
  });

  it('rejects with an actionable error when the device refuses', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) => fail(positionError(1)),
      },
    });
    await expect(getPosition()).rejects.toMatchObject({ code: 'LOCATION_PERMISSION_DENIED' });
  });

  it('reports unsupported rather than throwing when there is no geolocation API', async () => {
    vi.stubGlobal('navigator', {});
    expect(isGeolocationSupported()).toBe(false);
    await expect(getPosition()).rejects.toBeInstanceOf(AppError);
  });
});
