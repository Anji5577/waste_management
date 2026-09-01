import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppError, type EngineStatus } from '@/types';
import { ModelLoader } from './ModelLoader';

const status = (over: Partial<EngineStatus>): EngineStatus => ({
  stage: 'checking',
  message: 'Checking Gemini configuration…',
  error: null,
  ...over,
});

describe('ModelLoader', () => {
  it.each(['ready', 'checking', 'idle'] as const)('renders nothing when %s', (stage) => {
    // Nothing is wrong, so there is nothing to say. A running commentary on
    // readiness is noise competing with the task, and it named the model, which
    // the interface no longer surfaces.
    const { container } = render(
      <ModelLoader status={status({ stage, message: 'Ready — some-model' })} onRetry={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('does not name the model anywhere', () => {
    const { container } = render(
      <ModelLoader status={status({ stage: 'ready', message: 'Ready — gemini-3.5-flash' })} onRetry={vi.fn()} />,
    );
    expect(container.textContent ?? '').not.toMatch(/gemini/i);
  });

  it('tells the user exactly how to fix a missing key, and offers a re-check', async () => {
    // Without a key the app can do nothing at all, so this is the one status
    // that has to be loud and actionable.
    const onRetry = vi.fn();
    const error = new AppError('API_KEY_MISSING', 'No Gemini API key is configured.', {
      hint: 'Copy .env.example to .env, set VITE_GEMINI_API_KEY, then restart the dev server.',
    });
    render(<ModelLoader status={status({ stage: 'error', error })} onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No Gemini API key is configured.');
    expect(screen.getByText(/VITE_GEMINI_API_KEY/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /check again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows the hint rather than a stack trace when the key is rejected', () => {
    const error = new AppError('API_KEY_INVALID', 'The Gemini API key was rejected.', {
      hint: 'Check VITE_GEMINI_API_KEY in your .env file.',
      detail: 'HTTP 403: permission denied',
    });
    render(<ModelLoader status={status({ stage: 'error', error })} onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/rejected/);
    // The technical detail stays available for debugging, but collapsed — the
    // user sees plain language first, not an HTTP status.
    expect(screen.getByText(/HTTP 403/).closest('details')).not.toBeNull();
  });
});
