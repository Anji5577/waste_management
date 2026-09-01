import { useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import { useGeolocation } from '@/hooks/useGeolocation';
import { LocationBadge } from '@/components/common/LocationBadge';
import type { GeoStatus } from '@/types';
import { ErrorNotice } from '@/components/common/ErrorNotice';
import { ActionBar, PrimaryButton, SecondaryButton } from '@/components/common/ActionBar';

interface Props {
  onCapture: (canvas: HTMLCanvasElement, location: GeoStatus) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: Props) {
  const { videoRef, active, starting, error, canSwitch, facing, start, stop, switchCamera, capture } =
    useCamera();
  const geo = useGeolocation();

  useEffect(() => {
    void start();
    // Started alongside the camera, not at the shutter: a cold GPS fix can take
    // 20 seconds, and asking for it here means it is usually already resolved
    // by the time there is a photo to attach it to.
    void geo.request();
  }, [start, geo.request]);

  return (
    <div>
      {/*
        Portrait on phones, landscape on wider screens. A fixed 16:9 box left
        huge dead bars either side of a portrait phone stream, wasting the space
        that matters most for framing the item.
      */}
      <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-none bg-black sm:aspect-video sm:max-w-none">
        <video
          ref={videoRef}
          // playsInline is required on iOS — without it Safari takes the video
          // fullscreen and the capture button becomes unreachable.
          playsInline
          muted
          autoPlay
          aria-label="Live camera preview"
          className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
        {(starting || !active) && !error && (
          <p className="absolute inset-0 grid place-items-center text-base text-white/80">
            {starting ? 'Starting camera…' : 'Camera is off'}
          </p>
        )}
        <LocationBadge status={geo.status} />
        {active && canSwitch && (
          <button
            type="button"
            onClick={() => void switchCamera()}
            aria-label="Switch camera"
            className="tap absolute right-3 top-3 grid w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/70"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 9a8 8 0 0 1 13.3-3.3L20 8M20 15a8 8 0 0 1-13.3 3.3L4 16" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v4h-4M4 20v-4h4" />
            </svg>
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorNotice
            error={error}
            onRetry={() => {
              void start();
            }}
          />
        </div>
      )}

      <ActionBar>
        <PrimaryButton
          disabled={!active}
          onClick={() => {
            const canvas = capture();
            // Never block the shutter on a location fix — a photo taken beats a
            // photo missed while waiting for GPS.
            if (canvas) onCapture(canvas, geo.status);
          }}
        >
          Capture photo
        </PrimaryButton>
        <SecondaryButton
          onClick={() => {
            stop();
            onClose();
          }}
        >
          Cancel
        </SecondaryButton>
      </ActionBar>
    </div>
  );
}
