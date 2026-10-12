// @vitest-environment jsdom
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  getSalaryRecord: vi.fn(),
  getSalaryRecords: vi.fn(),
  upsertSalaryRecord: vi.fn(),
  deleteSalaryRecord: vi.fn(),
  close: vi.fn(),
}));
const validation = vi.hoisted(() => ({
  gate: undefined as Promise<void> | undefined,
  started: vi.fn(),
}));
vi.mock(
  '@hookform/resolvers/zod',
  async function delayedResolverModule(importOriginal) {
    const actual =
      await importOriginal<typeof import('@hookform/resolvers/zod')>();
    return {
      ...actual,
      zodResolver: function delayedZodResolver(
        ...args: Parameters<typeof actual.zodResolver>
      ) {
        const resolver = actual.zodResolver(...args);
        return async function resolveAfterGate(
          ...values: Parameters<typeof resolver>
        ) {
          validation.started();
          await validation.gate;
          return resolver(...values);
        };
      },
    };
  }
);
vi.mock('@/features/profile/actions/profile-actions', () => ({
  getProfile: api.getProfile,
  upsertProfile: api.upsertProfile,
}));
vi.mock('@/features/salary/actions/salary-actions', () => ({
  getSalaryRecord: api.getSalaryRecord,
  getSalaryRecords: api.getSalaryRecords,
  upsertSalaryRecord: api.upsertSalaryRecord,
  deleteSalaryRecord: api.deleteSalaryRecord,
}));
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  validation.gate = undefined;
  api.getProfile.mockResolvedValue({
    birthYear: 1990,
    isNsman: false,
    residencyStatus: 'resident',
  });
  api.upsertProfile.mockResolvedValue(undefined);
  api.getSalaryRecord.mockResolvedValue({
    id: '2026-01',
    salary: 1234.56,
    bonus: 0,
  });
  api.upsertSalaryRecord.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.unstubAllGlobals();
});
const domains = ['profile', 'salary'] as const;
type Domain = (typeof domains)[number];
async function mountForm(domain: Domain) {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        {domain === 'profile' ? (
          <ProfileForm />
        ) : (
          <SalaryFormDialog open editId="2026-01" onOpenChange={api.close} />
        )}
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
  const label = domain === 'profile' ? 'Birth Year' : 'Gross Salary';
  const input = await screen.findByLabelText(label);
  await waitFor(() =>
    expect(input).toHaveValue(domain === 'profile' ? 1990 : 1234.56)
  );
  fireEvent.change(input, {
    target: { value: domain === 'profile' ? '1991' : '5432.10' },
  });
  const form = input.closest('form');
  if (!form) throw new Error('Expected actual editor form');
  return {
    input,
    form,
    save: domain === 'profile' ? api.upsertProfile : api.upsertSalaryRecord,
  };
}
function hide() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Hide amounts', hidden: true })
  );
}
function show() {
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Show amounts', hidden: true })[0]
  );
}
describe('actual profile and salary submit visibility boundaries', () => {
  it.each(domains)(
    'rejects hidden %s initiation followed by immediate Show and permits a fresh visible submit',
    async (domain) => {
      const { form, save } = await mountForm(domain);
      const calls = validation.started.mock.calls.length;
      hide();
      fireEvent.submit(form);
      show();
      await act(async function flushHiddenSubmission() {
        await Promise.resolve();
      });
      expect(save).not.toHaveBeenCalled();
      expect(validation.started).toHaveBeenCalledTimes(calls);
      fireEvent.submit(form);
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    }
  );
  it('invalidates a profile submission during delayed real resolver validation and permits a fresh visible retry', async () => {
    const { form, input, save } = await mountForm('profile');
    let release!: () => void;
    validation.gate = new Promise<void>(function delayValidation(resolve) {
      release = resolve;
    });
    const calls = validation.started.mock.calls.length;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(validation.started.mock.calls.length).toBeGreaterThan(calls)
    );
    hide();
    show();
    await act(async function finishOldValidation() {
      release();
      await validation.gate;
    });
    expect(save).not.toHaveBeenCalled();
    expect(input).toHaveValue(1991);
    validation.gate = undefined;
    fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      birthYear: 1991,
      isNsman: false,
      residencyStatus: 'resident',
    });
  });
  it('invalidates a salary submission across the actual built-in asynchronous validation boundary and permits a fresh visible retry', async () => {
    const { form, input, save } = await mountForm('salary');
    // Salary has no resolver. RHF awaits its real built-in field validation before invoking submit.
    fireEvent.submit(form);
    hide();
    show();
    await act(async function finishBuiltInValidation() {
      await Promise.resolve();
    });
    expect(save).not.toHaveBeenCalled();
    expect(input).toHaveValue(5432.1);
    fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      id: '2026-01',
      salary: 5432.1,
      bonus: 0,
    });
  });
});
