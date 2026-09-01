import { useCallback, useEffect, useRef, useState } from 'react';
import { isStorageConfigured, listReports, type StoredReport } from '@/services/reports';
import { AppError } from '@/types';

export type ReportsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; reports: StoredReport[] }
  | { status: 'error'; error: AppError };

export function useReports(enabled: boolean, imgbbAvailable: boolean) {
  const [state, setState] = useState<ReportsState>({ status: 'idle' });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!isStorageConfigured(imgbbAvailable)) {
      setState({
        status: 'error',
        error: new AppError('STORAGE_NOT_CONFIGURED', 'Saved reports are not configured.', {
          hint: 'Set VITE_IMGBB_API_KEY, VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
        }),
      });
      return;
    }
    setState({ status: 'loading' });
    try {
      const reports = await listReports();
      if (mounted.current) setState({ status: 'ready', reports });
    } catch (error) {
      if (!mounted.current) return;
      setState({
        status: 'error',
        error:
          error instanceof AppError
            ? error
            : new AppError('REPORT_FETCH_FAILED', 'Saved reports could not be loaded.'),
      });
    }
  }, [imgbbAvailable]);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { state, reload: load };
}
