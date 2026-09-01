import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from './ImageUpload';

const jpeg = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], 'waste.jpg', {
    type: 'image/jpeg',
  });
const notAnImage = () =>
  new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0, 0, 0])], 'doc.png', {
    type: 'image/png',
  });

/** The <input type=file> is visually hidden behind a styled label. */
function input(): HTMLInputElement {
  return screen.getByLabelText(/upload image/i);
}

describe('ImageUpload', () => {
  it('accepts a valid image and hands it to the caller', async () => {
    const onSelect = vi.fn();
    render(<ImageUpload onSelect={onSelect} />);
    await userEvent.upload(input(), jpeg());
    await waitFor(() => expect(onSelect).toHaveBeenCalledOnce());
    expect(onSelect.mock.calls[0]?.[0]).toBeInstanceOf(File);
  });

  it('rejects a file whose bytes are not an image, despite its name and MIME type', async () => {
    const onSelect = vi.fn();
    render(<ImageUpload onSelect={onSelect} />);
    await userEvent.upload(input(), notAnImage());
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a JPG, PNG, or WEBP/i);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clears a previous error once a good file arrives', async () => {
    render(<ImageUpload onSelect={vi.fn()} />);
    await userEvent.upload(input(), notAnImage());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.upload(input(), jpeg());
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('states the accepted formats up front', () => {
    // Rendered twice by design — a compact line for phones and a fuller one
    // inside the drag target, which only exists from `sm` up.
    render(<ImageUpload onSelect={vi.fn()} />);
    expect(screen.getAllByText(/JPG, PNG, WEBP/i).length).toBeGreaterThan(0);
  });

  it('is reachable by keyboard through a labelled control', () => {
    render(<ImageUpload onSelect={vi.fn()} />);
    expect(screen.getByLabelText(/upload image/i)).toBe(input());
  });

  it('does not accept input while an analysis is running', () => {
    render(<ImageUpload onSelect={vi.fn()} disabled />);
    expect(input()).toBeDisabled();
  });
});
