import { useCallback, useId, useState } from 'react';
import { IMAGE } from '@/config';
import { validateImageFile } from '@/ai/preprocessing/validateFile';
import { AppError } from '@/types';
import { ErrorNotice } from '@/components/common/ErrorNotice';

interface Props {
  onSelect: (file: File) => void;
  disabled?: boolean;
}

/**
 * File input.
 *
 * A drag-and-drop target is meaningless on a phone, so it only appears from the
 * `sm` breakpoint up. On mobile this is a plain full-width button, which is
 * what the interaction actually is there.
 */
export function ImageUpload({ onSelect, disabled }: Props) {
  const inputId = useId();
  const [error, setError] = useState<AppError | null>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      try {
        await validateImageFile(file);
        onSelect(file);
      } catch (err) {
        setError(
          err instanceof AppError
            ? err
            : new AppError('FILE_TYPE_INVALID', 'That file could not be used.'),
        );
      }
    },
    [onSelect],
  );

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void accept(e.dataTransfer.files[0]);
        }}
        className={`tap flex cursor-pointer items-center justify-center gap-2.5 rounded-none border border-[var(--border)] bg-[var(--surface-raised)] px-5 text-base font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/5 sm:flex-col sm:gap-1.5 sm:border-2 sm:border-dashed sm:py-10 ${
          dragging ? 'border-[var(--color-brand-accent)] bg-[var(--color-brand-accent-soft)]/25' : ''
        } ${disabled ? 'pointer-events-none opacity-45' : ''}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-5 shrink-0 text-[var(--color-brand-accent)] sm:size-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          />
        </svg>
        <span>Upload image</span>
        <span className="hidden text-sm font-normal text-[var(--text-muted)] sm:block">
          Drag a photo here, or click to browse · JPG, PNG, WEBP · up to{' '}
          {(IMAGE.MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB
        </span>
      </label>
      <p className="text-center text-sm text-[var(--text-muted)] sm:hidden">
        JPG, PNG, WEBP · up to {(IMAGE.MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB
      </p>
      <input
        id={inputId}
        type="file"
        className="sr-only"
        accept={IMAGE.ACCEPTED_MIME.join(',')}
        disabled={disabled ?? false}
        onChange={(e) => {
          void accept(e.target.files?.[0]);
          // Reset so re-selecting the same file fires `change` again.
          e.target.value = '';
        }}
      />
      {error && <ErrorNotice error={error} />}
    </div>
  );
}
