import { describe, expect, it } from 'vitest';
import { OSM_ATTRIBUTION, toPlaceName } from './reverseGeocode';

describe('toPlaceName', () => {
  it('builds the two lines a GPS-camera stamp shows', () => {
    const place = toPlaceName(
      {
        road: 'Addada Road',
        village: 'Gudlavalleru',
        state_district: 'Krishna',
        state: 'Andhra Pradesh',
        postcode: '521356',
        country: 'India',
      },
      'ignored',
    );
    expect(place.region).toBe('Gudlavalleru, Andhra Pradesh, India');
    expect(place.detail).toBe('Addada Road, Gudlavalleru, Krishna, 521356');
  });

  it('omits fields the geocoder did not return rather than inventing them', () => {
    // An address on a dumping report is evidence. A plausible-looking guess at
    // a street name is worse than showing no street at all.
    const place = toPlaceName({ state: 'Andhra Pradesh', country: 'India' }, 'fallback');
    expect(place.region).toBe('Andhra Pradesh, India');
    expect(place.detail).not.toMatch(/undefined|null|,\s*,/);
  });

  it('prefers the most specific locality available', () => {
    expect(toPlaceName({ city: 'Vijayawada', village: 'X', country: 'India' }, '').region).toBe(
      'Vijayawada, India',
    );
    expect(toPlaceName({ town: 'Gudivada', country: 'India' }, '').region).toBe(
      'Gudivada, India',
    );
  });

  it('falls back to the display name when the structured address is bare', () => {
    const place = toPlaceName({}, 'Somewhere, Some State, Some Country');
    expect(place.region).toBeTruthy();
    expect(place.detail).toBe('Somewhere, Some State, Some Country');
  });

  it('never emits empty separators from missing middle fields', () => {
    const place = toPlaceName({ road: 'Main Road', country: 'India' }, '');
    expect(place.detail).toBe('Main Road');
  });

  it('exposes the attribution the OSM licence requires', () => {
    expect(OSM_ATTRIBUTION).toMatch(/OpenStreetMap/);
  });
});
