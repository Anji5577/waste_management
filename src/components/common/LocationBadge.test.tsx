import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppError, type GeoPoint, type GeoStatus } from '@/types';
import { LocationBadge, LocationRow } from './LocationBadge';

const point: GeoPoint = {
  latitude: 17.385044,
  longitude: 78.486671,
  accuracy: 12,
  timestamp: 1_700_000_000_000,
};
const ready: GeoStatus = { stage: 'ready', point, error: null, place: null };

describe('LocationBadge', () => {
  it('shows the coordinates and how precise they are', () => {
    render(<LocationBadge status={ready} />);
    expect(screen.getByText('17.385044, 78.486671')).toBeInTheDocument();
    // Accuracy matters as much as the fix: "here" ±2 km is a different claim.
    expect(screen.getByText('±12 m')).toBeInTheDocument();
  });

  it('renders nothing before a request has been made', () => {
    const { container } = render(
      <LocationBadge status={{ stage: 'idle', point: null, error: null, place: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('announces that it is still looking', () => {
    render(<LocationBadge status={{ stage: 'locating', point: null, error: null, place: null }} />);
    expect(screen.getByText(/finding location/i)).toBeInTheDocument();
  });

  it.each(['error', 'unsupported'] as const)('states plainly when %s', (stage) => {
    render(
      <LocationBadge
        status={{ stage, point: null, place: null, error: new AppError('LOCATION_UNAVAILABLE', 'nope') }}
      />,
    );
    expect(screen.getByText(/no location recorded/i)).toBeInTheDocument();
  });
});

describe('LocationRow', () => {
  it('offers a way to open the spot in a map', () => {
    render(<LocationRow status={ready} />);
    const link = screen.getByRole('link', { name: /open in maps/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('17.385044,78.486671'));
    // A third-party navigation, so deny the opened page access to this one.
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('explains a failure instead of silently showing nothing', () => {
    render(
      <LocationRow
        status={{
          stage: 'error',
          point: null,
          place: null,
          error: new AppError('LOCATION_PERMISSION_DENIED', 'Location access was blocked.', {
            hint: 'Allow location for this site.',
          }),
        }}
      />,
    );
    expect(screen.getByText(/location access was blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/allow location for this site/i)).toBeInTheDocument();
  });

  it('stays out of the way when no location was ever requested', () => {
    const { container } = render(
      <LocationRow status={{ stage: 'idle', point: null, error: null, place: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
