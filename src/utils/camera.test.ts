import { describe, expect, it } from 'vitest';
import { toCameraError } from './camera';

function domError(name: string): Error {
  const e = new Error(`${name} raised`);
  e.name = name;
  return e;
}

describe('toCameraError', () => {
  it.each([
    ['NotAllowedError', 'CAMERA_PERMISSION_DENIED'],
    ['SecurityError', 'CAMERA_PERMISSION_DENIED'],
    ['NotFoundError', 'CAMERA_NOT_FOUND'],
    ['DevicesNotFoundError', 'CAMERA_NOT_FOUND'],
    ['NotReadableError', 'CAMERA_IN_USE'],
    ['TrackStartError', 'CAMERA_IN_USE'],
    ['OverconstrainedError', 'CAMERA_CONSTRAINTS'],
  ])('maps %s to %s', (name, code) => {
    expect(toCameraError(domError(name)).code).toBe(code);
  });

  it('falls back to a generic code for an unknown failure', () => {
    expect(toCameraError(domError('SomethingNew')).code).toBe('CAMERA_UNKNOWN');
  });

  it('handles a non-Error rejection', () => {
    expect(toCameraError('boom').code).toBe('CAMERA_UNKNOWN');
  });

  it('never leaks the DOM error name into user-facing text', () => {
    // "NotReadableError" tells a user nothing; the message must be plain English.
    const err = toCameraError(domError('NotReadableError'));
    expect(err.message).not.toMatch(/Error$/);
    expect(err.message).toBe('The camera is already in use.');
    expect(err.hint).toMatch(/close any other app/i);
    expect(err.detail).toContain('NotReadableError');
  });

  it('always offers a recovery path', () => {
    for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'Weird']) {
      expect(toCameraError(domError(name)).hint).toBeTruthy();
    }
  });
});
