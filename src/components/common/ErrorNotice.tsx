import type { AppError } from '@/types';

interface Props {
  error: AppError;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Plain language first, recovery second, technical detail last and collapsed.
 * A user shown "NotReadableError" learns nothing; a developer still needs it.
 */
export function ErrorNotice({ error, onRetry, retryLabel = 'Try again' }: Props) {
  return (
    <div
      role="alert"
      className="rounded-none border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50"
    >
      <p className="text-base font-bold text-red-900 dark:text-red-200">{error.message}</p>
      {error.hint && (
        <p className="mt-1 text-sm leading-relaxed text-red-800 dark:text-red-300">{error.hint}</p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tap mt-3 inline-flex items-center rounded-none bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800"
        >
          {retryLabel}
        </button>
      )}
      {error.detail && (
        <details className="mt-3">
          <summary className="tap inline-flex cursor-pointer items-center text-sm text-red-800/80 dark:text-red-300/80">
            Technical detail
          </summary>
          <pre className="mt-1 overflow-x-auto rounded-none bg-red-100 p-2 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-200">
            {error.code}: {error.detail}
          </pre>
        </details>
      )}
    </div>
  );
}
