import type { EngineStatus } from '@/types';
import { ErrorNotice } from '@/components/common/ErrorNotice';

interface Props {
  status: EngineStatus;
  onRetry: () => void;
}

/**
 * Engine status.
 *
 * Silent unless something is wrong.
 *
 * With a hosted API there is nothing to wait for, so a running commentary on
 * readiness is noise. The one case that still has to shout is a missing or
 * rejected key, because nothing works at all until that is fixed.
 */
export function ModelLoader({ status, onRetry }: Props) {
  if (status.stage === 'error' && status.error) {
    return <ErrorNotice error={status.error} onRetry={onRetry} retryLabel="Check again" />;
  }

  return null;
}
