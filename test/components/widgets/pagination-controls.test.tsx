// @vitest-environment jsdom
import { PaginationControls } from '@/components/widgets';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(cleanup);

it('retains default sizes for existing consumers', async () => {
  render(
    <PaginationControls
      page={0}
      pageSize={10}
      total={60}
      itemLabel="record"
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: '10' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '25' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '50' })).toBeInTheDocument();
});

it('offers only the caller-constrained20 rows and working keyboard page navigation', async () => {
  const change = vi.fn();
  render(
    <PaginationControls
      page={0}
      pageSize={20}
      pageSizes={[20]}
      total={21}
      itemLabel="expense"
      onPageChange={change}
      onPageSizeChange={vi.fn()}
    />
  );
  const user = userEvent.setup();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(screen.getByText('Showing 1–20 of 21 expenses')).toBeInTheDocument();
  screen.getByRole('button', { name: 'Next page' }).focus();
  await user.keyboard('{Enter}');
  expect(change).toHaveBeenCalledWith(1);
});
