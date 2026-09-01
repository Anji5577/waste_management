import type { ReactNode } from 'react';

/**
 * Sticky primary actions, pinned to the thumb zone.
 *
 * On a phone the previous layout put Analyze mid-page, so it scrolled away the
 * moment a preview appeared. Anchoring it to the bottom keeps the one action
 * that matters permanently reachable one-handed, and `pb-safe` keeps it clear
 * of the iPhone home indicator.
 */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-[var(--border)] bg-[var(--bar)] px-4 pt-3 backdrop-blur-md pb-safe sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-2xl gap-3">{children}</div>
    </div>
  );
}

const BASE =
  'tap inline-flex flex-1 items-center justify-center gap-2 rounded-none px-5 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45';

export function PrimaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} bg-[var(--color-brand-accent)] text-white hover:bg-[var(--color-brand-accent-hover)] active:bg-[#046a30] ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE} max-w-[9rem] flex-none border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5 ${props.className ?? ''}`}
    >
      {children}
    </button>
  );
}
