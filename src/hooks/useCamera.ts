import { useCallback, useEffect, useRef, useState } from 'react';
import {
  hasMultipleCameras,
  insecureContextError,
  isCameraSupported,
  isSecureContextForCamera,
  toCameraError,
} from '@/utils/camera';
import { AppError } from '@/types';

export type Facing = 'environment' | 'user';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [facing, setFacing] = useState<Facing>('environment');
  const [canSwitch, setCanSwitch] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const start = useCallback(
    async (requested: Facing = facing) => {
      setError(null);
      if (!isCameraSupported()) {
        setError(
          new AppError('UNSUPPORTED_BROWSER', 'This browser cannot access the camera.', {
            hint: 'Use a recent version of Chrome, Edge, Firefox or Safari — or upload a photo instead.',
          }),
        );
        return;
      }
      if (!isSecureContextForCamera()) {
        setError(insecureContextError());
        return;
      }

      setStarting(true);
      // Release the previous stream first: on mobile, holding the rear camera
      // open makes the request for the front camera fail outright.
      stop();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: requested },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setFacing(requested);
        setActive(true);
        setCanSwitch(await hasMultipleCameras());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {
            /* autoplay rejection is recoverable — the poster frame still shows */
          });
        }
      } catch (err) {
        setError(toCameraError(err));
        stop();
      } finally {
        setStarting(false);
      }
    },
    [facing, stop],
  );

  const switchCamera = useCallback(
    () => start(facing === 'environment' ? 'user' : 'environment'),
    [facing, start],
  );

  /** Grab the current frame. Stays in memory — never uploaded. */
  const capture = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // The preview is mirrored for the selfie camera; un-mirror it so the model
    // and any on-screen text see the scene the right way round.
    if (facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, [facing]);

  useEffect(() => stop, [stop]);

  return { videoRef, active, starting, error, facing, canSwitch, start, stop, switchCamera, capture };
}
