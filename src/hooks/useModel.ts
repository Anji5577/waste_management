import { useCallback, useEffect, useRef, useState } from 'react';
import { getEngine } from '@/ai/engine';
import { fetchServerConfig } from '@/ai/gemini/apiKey';
import type { EngineStatus } from '@/types';

const IDLE: EngineStatus = { stage: 'idle', message: 'Checking configuration…', error: null };

/**
 * Engine readiness.
 *
 * With a hosted API this is a configuration check, not a download — it resolves
 * in a millisecond or fails immediately with a missing key. The hook is kept
 * because the UI contract is unchanged, and because a future engine may again
 * need real preparation.
 */
export function useModel() {
  const [status, setStatus] = useState<EngineStatus>(IDLE);
  // Whether the server holds an image-host key. The browser cannot check this
  // itself now that the key is server-side.
  const [imgbbAvailable, setImgbbAvailable] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      await getEngine().prepare((s) => {
        if (mounted.current) setStatus(s);
      });
      const config = await fetchServerConfig();
      if (mounted.current) setImgbbAvailable(config.imgbb);
    } catch {
      // prepare() already reported the failure through onStatus; swallowing here
      // keeps an already-surfaced error out of the console as an unhandled
      // rejection.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, reload: load, isReady: status.stage === 'ready', imgbbAvailable };
}
