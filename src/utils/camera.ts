import { AppError, type AppErrorCode } from '@/types';

/**
 * Translate a getUserMedia rejection into something a person can act on.
 *
 * The DOM names are not user-facing text — "NotReadableError" tells someone
 * nothing, whereas "another app is using your camera" tells them what to do.
 */
export function toCameraError(error: unknown): AppError {
  const name = error instanceof Error ? error.name : '';
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  const map: Partial<Record<string, { code: AppErrorCode; message: string; hint: string }>> = {
    NotAllowedError: {
      code: 'CAMERA_PERMISSION_DENIED',
      message: 'Camera access was blocked.',
      hint: 'Allow camera access for this site in your browser’s address-bar permissions, then try again. You can also upload a photo instead.',
    },
    SecurityError: {
      code: 'CAMERA_PERMISSION_DENIED',
      message: 'Camera access was blocked.',
      hint: 'Allow camera access for this site in your browser settings, or upload a photo instead.',
    },
    NotFoundError: {
      code: 'CAMERA_NOT_FOUND',
      message: 'No camera was found on this device.',
      hint: 'Upload a photo instead.',
    },
    DevicesNotFoundError: {
      code: 'CAMERA_NOT_FOUND',
      message: 'No camera was found on this device.',
      hint: 'Upload a photo instead.',
    },
    NotReadableError: {
      code: 'CAMERA_IN_USE',
      message: 'The camera is already in use.',
      hint: 'Close any other app or tab using the camera, then try again.',
    },
    TrackStartError: {
      code: 'CAMERA_IN_USE',
      message: 'The camera could not be started.',
      hint: 'Close any other app using the camera, then try again.',
    },
    OverconstrainedError: {
      code: 'CAMERA_CONSTRAINTS',
      message: 'This camera does not support the requested settings.',
      hint: 'Try switching between the front and rear camera.',
    },
    ConstraintNotSatisfiedError: {
      code: 'CAMERA_CONSTRAINTS',
      message: 'This camera does not support the requested settings.',
      hint: 'Try switching between the front and rear camera.',
    },
  };

  const known = map[name];
  if (known) {
    return new AppError(known.code, known.message, { hint: known.hint, detail, cause: error });
  }
  return new AppError('CAMERA_UNKNOWN', 'The camera could not be started.', {
    hint: 'Reload the page and try again, or upload a photo instead.',
    detail,
    cause: error,
  });
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * getUserMedia silently requires a secure context. Without this check the user
 * sees a bare permission failure on http:// and has no idea why.
 */
export function isSecureContextForCamera(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

export function insecureContextError(): AppError {
  return new AppError('CAMERA_INSECURE_CONTEXT', 'The camera needs a secure connection.', {
    hint: 'Open this site over HTTPS (or on localhost) to use the camera. You can still upload a photo.',
  });
}

export async function hasMultipleCameras(): Promise<boolean> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'videoinput').length > 1;
  } catch {
    return false;
  }
}
