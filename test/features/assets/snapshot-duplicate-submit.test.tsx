// @vitest-environment jsdom
import { SnapshotForm } from '@/features/assets/components/snapshot-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const external = vi.hoisted(() => ({
  getSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
  upsertSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/features/assets/actions/snapshot-actions', () => external);
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: external.push }),
}));
vi.mock('sonner', () => ({
  toast: { error: external.error, success: vi.fn() },
}));
afterEach(cleanup);
it('rejects duplicate month at submit even when the disabled button is bypassed', async () => {
  external.getSnapshots.mockResolvedValue([{ id: '2026-01', entries: [] }]);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <SnapshotForm />
    </QueryClientProvider>
  );
  await screen.findByRole('button', { name: 'Save Snapshot' });
  fireEvent.change(screen.getByLabelText('Select Month'), {
    target: { value: '2026-01' },
  });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], {
    target: { value: '100' },
  });
  expect(
    (screen.getByRole('button', { name: 'Save Snapshot' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() =>
    expect(external.error).toHaveBeenCalledWith(
      'A snapshot for this month already exists.'
    )
  );
  expect(external.upsertSnapshot).not.toHaveBeenCalled();
  expect(external.push).not.toHaveBeenCalled();
});
