import { AppError, type GeoPoint } from '@/types';

/**
 * Turn coordinates into a human address.
 *
 * Uses OpenStreetMap's Nominatim, which needs no API key. Google's Geocoding
 * API was tried first and rejected the Gemini key outright — it is a separate
 * Maps Platform product with its own billing, which this project does not have.
 *
 * This is a SECOND third-party disclosure: the coordinates (not the photo) are
 * sent to OSM. The UI says so, and a failure here degrades to coordinates only
 * rather than blocking anything.
 *
 * Nominatim's usage policy asks for identification, at most one request per
 * second, and caching. Browsers set Referer automatically and forbid setting
 * User-Agent, so the rate limit and cache are enforced here.
 */

export interface PlaceName {
  /** Broad line, e.g. "Krishna, Andhra Pradesh, India". */
  readonly region: string;
  /** Precise line, e.g. "Addada Road, Gudlavalleru, Krishna, 521356". */
  readonly detail: string;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const MIN_INTERVAL_MS = 1100;
const TIMEOUT_MS = 8_000;

const cache = new Map<string, PlaceName>();
let lastCallAt = 0;

/** ~11 m of precision — finer than any phone fix, and a good cache key. */
function key(point: GeoPoint): string {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

/**
 * Build the two lines a GPS-camera stamp shows.
 *
 * Only fields Nominatim actually returned are used — no placeholders and no
 * inference. An address on a dumping report is evidence, and inventing a street
 * because one was expected would be worse than showing coordinates alone.
 */
export function toPlaceName(address: NominatimAddress, displayName: string): PlaceName {
  const locality =
    address.city ?? address.town ?? address.village ?? address.municipality ?? address.suburb;
  const district = address.state_district ?? address.county;

  const region = [locality ?? district, address.state, address.country].filter(Boolean).join(', ');

  const detail = [
    address.road,
    address.neighbourhood ?? address.suburb,
    locality,
    district,
    address.postcode,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    region: region || displayName.split(',').slice(-3).join(',').trim(),
    detail: detail || displayName,
  };
}

export async function reverseGeocode(point: GeoPoint): Promise<PlaceName> {
  const cached = cache.get(key(point));
  if (cached) return cached;

  const wait = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url =
    `${ENDPOINT}?format=jsonv2&lat=${point.latitude}&lon=${point.longitude}` +
    `&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new AppError('GEOCODE_FAILED', 'The address lookup failed.', {
        hint: 'The coordinates are still recorded.',
        detail: `HTTP ${response.status}`,
      });
    }
    const body = (await response.json()) as {
      address?: NominatimAddress;
      display_name?: string;
      error?: string;
    };
    if (body.error || !body.address) {
      throw new AppError('GEOCODE_FAILED', 'No address matched this location.', {
        hint: 'The coordinates are still recorded.',
        detail: body.error ?? 'no address in response',
      });
    }

    const place = toPlaceName(body.address, body.display_name ?? '');
    cache.set(key(point), place);
    return place;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw new AppError('GEOCODE_FAILED', 'The address could not be looked up.', {
      hint: 'Check your connection. The coordinates are still recorded.',
      cause,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Nominatim's licence requires this to be shown wherever results appear. */
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';
