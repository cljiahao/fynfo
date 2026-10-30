// @vitest-environment jsdom
import { ConfirmDeleteDialog } from '@/features/household/components/confirm-delete-dialog';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function renderDialog(overrides: { onConfirm?: () => void } = {}) {
  const onConfirm = overrides.onConfirm ?? vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfirmDeleteDialog
      open
      onOpenChange={onOpenChange}
      title="Delete goal?"
      description="This also deletes 3 contributions."
      confirmLabel="Delete goal"
      onConfirm={onConfirm}
    />
  );
  return { onConfirm, onOpenChange };
}

describe('ConfirmDeleteDialog', () => {
  it('shows the title and description', () => {
    renderDialog();
    expect(screen.getByText('Delete goal?')).toBeInTheDocument();
    expect(
      screen.getByText('This also deletes 3 contributions.')
    ).toBeInTheDocument();
  });

  it('focuses Cancel first', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('Cancel closes without confirming', () => {
    const { onConfirm, onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Confirm calls onConfirm once', () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Delete goal' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders the confirm button with the destructive variant', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: 'Delete goal' })).toHaveClass(
      'bg-destructive'
    );
  });

  it('disables both buttons while pending', () => {
    render(
      <ConfirmDeleteDialog
        open
        onOpenChange={vi.fn()}
        title="t"
        description="d"
        confirmLabel="Delete"
        onConfirm={vi.fn()}
        pending
      />
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
