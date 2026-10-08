// @vitest-environment jsdom
import { EditableRow } from '@/features/expenses/components/editable-expense-row';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/features/expenses/components/split-dialog', () => ({
  SplitDialog: () => null,
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('does not save a blurred draft after row unmount', () => {
  vi.useFakeTimers();
  const save = vi.fn();
  const view = render(
    <table>
      <tbody>
        <EditableRow
          row={{
            id: 'a',
            date: '2026-01-01',
            type: 'food_drink',
            item: 'item',
            info: '',
            amount: 10,
            splitType: 'self',
            splits: [],
          }}
          isNew={false}
          peopleSuggestions={[]}
          onSave={save}
          onDelete={vi.fn()}
        />
      </tbody>
    </table>
  );
  fireEvent.blur(screen.getByDisplayValue('item'), { relatedTarget: null });
  view.unmount();
  vi.advanceTimersByTime(1000);
  expect(save).not.toHaveBeenCalled();
});
