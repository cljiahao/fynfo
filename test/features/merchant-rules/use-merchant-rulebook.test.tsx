// @vitest-environment jsdom
import { useMerchantRulebook } from '@/features/merchant-rules/hooks/use-merchant-rulebook';
import type {
  MerchantRule,
  MerchantRulebook,
  SaveRulebookInput,
  SaveRulebookOutcome,
} from '@/features/merchant-rules/types';
import {
  AmountVisibilityProvider,
  useAmountVisibility,
} from '@/features/privacy';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('@/features/merchant-rules/actions/rulebook-actions', () => ({
  getMerchantRulebook: mocks.read,
  saveMerchantRulebook: mocks.save,
}));
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const rule: MerchantRule = {
  id: '851af27a-e752-4aa5-8294-44b02bd911ca',
  label: 'Market',
  enabled: true,
  matchMode: 'exact',
  matchText: 'MARKET',
  bank: null,
  displayName: 'Market',
  category: 'groceries',
};
function view() {
  return renderHook(
    () => ({ rules: useMerchantRulebook(), privacy: useAmountVisibility() }),
    { wrapper: AmountVisibilityProvider }
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.read.mockResolvedValue(null);
  mocks.save.mockResolvedValue({ status: 'saved', revision: '1' });
});
afterEach(cleanup);

it('preserves the draft revision through Hide/Show so a concurrent edit cannot be overwritten', async () => {
  const original: MerchantRulebook = {
    id: rule.id,
    revision: '1',
    payload: {
      schemaVersion: 1,
      requestId: 'ff65feb2-8ffa-427c-a057-8779580f162f',
      rules: [rule],
    },
  };
  mocks.read.mockResolvedValue(original);
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  mocks.read.mockResolvedValue({
    ...original,
    revision: '2',
    payload: { ...original.payload, rules: [] },
  });
  mocks.save.mockResolvedValue({ status: 'conflict' });
  act(() => v.result.current.privacy.hideAmounts());
  act(() => v.result.current.privacy.showAmounts());
  await act(async () => {
    await v.result.current.rules.save([{ ...rule, label: 'My old draft' }]);
  });
  expect(mocks.read).toHaveBeenCalledTimes(1);
  expect(mocks.save.mock.calls[0][0].expectedRevision).toBe('1');
  expect(v.result.current.rules.stage).toBe('conflict');
});

it('finishes loading under Strict Mode while its discarded first read remains pending', async () => {
  const old = deferred<MerchantRulebook | null>();
  mocks.read.mockReturnValueOnce(old.promise);
  const view = renderHook(() => useMerchantRulebook(), {
    reactStrictMode: true,
    wrapper: AmountVisibilityProvider,
  });
  await waitFor(() => expect(view.result.current.stage).toBe('ready'));
  expect(mocks.read).toHaveBeenCalledTimes(2);
  await act(async () => old.resolve(null));
  expect(view.result.current.stage).toBe('ready');
  expect(mocks.save).not.toHaveBeenCalled();
});

it('reads without writing and saves once despite same-tick duplicate activation', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  expect(mocks.save).not.toHaveBeenCalled();
  const pending = deferred<SaveRulebookOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let first!: Promise<boolean>;
  act(() => {
    first = v.result.current.rules.save([rule]);
    void v.result.current.rules.save([rule]);
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
  await act(async () => {
    pending.resolve({ status: 'saved', revision: '1' });
    await first;
  });
  expect(v.result.current.rules.rules).toEqual([rule]);
});
it('retains frozen identity after missing acknowledgement and confirms only exact current values', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  mocks.save.mockRejectedValue(new Error('lost acknowledgement'));
  await act(async () => {
    await v.result.current.rules.save([rule]);
  });
  expect(v.result.current.rules.stage).toBe('unconfirmed');
  await act(async () => {
    await v.result.current.rules.check();
    await v.result.current.rules.save([rule]);
  });
  expect(v.result.current.rules.stage).toBe('unconfirmed');
  expect(mocks.save).toHaveBeenCalledTimes(1);
  const input = mocks.save.mock.calls[0][0] as SaveRulebookInput;
  mocks.read.mockResolvedValue({
    id: input.id,
    revision: '1',
    payload: input.payload,
  });
  await act(async () => {
    await v.result.current.rules.check();
  });
  expect(v.result.current.rules.stage).toBe('ready');
  expect(v.result.current.rules.rules).toEqual([rule]);
});
it('freezes conflicting and deleted/missing submissions without automatic replay', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  mocks.save.mockResolvedValue({ status: 'unconfirmed' });
  await act(async () => {
    await v.result.current.rules.save([rule]);
  });
  const input = mocks.save.mock.calls[0][0] as SaveRulebookInput;
  mocks.read.mockResolvedValue({
    id: input.id,
    revision: '2',
    payload: { ...input.payload, rules: [] },
  });
  await act(async () => {
    await v.result.current.rules.check();
  });
  expect(v.result.current.rules.stage).toBe('conflict');
  expect(v.result.current.rules.canEdit).toBe(false);
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it('rejects a pending save acknowledgement after immediate Hide/Show and allows explicit check', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  const pending = deferred<SaveRulebookOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let saving!: Promise<boolean>;
  act(() => {
    saving = v.result.current.rules.save([rule]);
  });
  act(() => {
    v.result.current.privacy.hideAmounts();
    v.result.current.privacy.showAmounts();
  });
  await act(async () => {
    pending.resolve({ status: 'saved', revision: '1' });
    await saving;
  });
  expect(v.result.current.rules.stage).toBe('unconfirmed');
  expect(v.result.current.rules.rules).toEqual([]);
  const input = mocks.save.mock.calls[0][0] as SaveRulebookInput;
  mocks.read.mockResolvedValue({
    id: input.id,
    revision: '1',
    payload: input.payload,
  });
  await act(async () => {
    await v.result.current.rules.check();
  });
  expect(v.result.current.rules.stage).toBe('ready');
});
it('blocks hidden initiation and ignores read results after owner teardown', async () => {
  const pending = deferred<MerchantRulebook | null>();
  mocks.read.mockReturnValue(pending.promise);
  const v = view();
  act(() => v.result.current.privacy.hideAmounts());
  await act(async () => {
    await v.result.current.rules.save([rule]);
  });
  expect(mocks.save).not.toHaveBeenCalled();
  v.unmount();
  await act(async () => pending.resolve(null));
  expect(mocks.read).toHaveBeenCalledTimes(1);
});
it('can check after Hide/Show before the old dispatched save answers, without a later downgrade', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  const pending = deferred<SaveRulebookOutcome>();
  mocks.save.mockReturnValue(pending.promise);
  let saving!: Promise<boolean>;
  act(() => {
    saving = v.result.current.rules.save([rule]);
  });
  const input = mocks.save.mock.calls[0][0] as SaveRulebookInput;
  act(() => v.result.current.privacy.hideAmounts());
  act(() => v.result.current.privacy.showAmounts());
  expect(v.result.current.rules.stage).toBe('unconfirmed');
  mocks.read.mockResolvedValue({
    id: input.id,
    revision: '1',
    payload: input.payload,
  });
  await act(async () => {
    await v.result.current.rules.check();
  });
  expect(v.result.current.rules.stage).toBe('ready');
  await act(async () => {
    pending.resolve({ status: 'saved', revision: '1' });
    await saving;
  });
  expect(v.result.current.rules.stage).toBe('ready');
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
it('keeps failed loading unavailable and supports explicit reload', async () => {
  mocks.read.mockRejectedValueOnce(new Error('private failure'));
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('error'));
  expect(v.result.current.rules.message).not.toContain('private');
  await act(async () => {
    await v.result.current.rules.load();
  });
  expect(v.result.current.rules.stage).toBe('ready');
});
it('retains editable draft after definite rejection and handles failed confirmation reads', async () => {
  const v = view();
  await waitFor(() => expect(v.result.current.rules.stage).toBe('ready'));
  mocks.save.mockResolvedValueOnce({ status: 'not_saved' });
  await act(async () => {
    await v.result.current.rules.save([rule]);
  });
  expect(v.result.current.rules.canEdit).toBe(true);
  mocks.save.mockResolvedValueOnce({ status: 'unconfirmed' });
  await act(async () => {
    await v.result.current.rules.save([rule]);
  });
  mocks.read.mockRejectedValueOnce(new Error('private read'));
  await act(async () => {
    await v.result.current.rules.check();
  });
  expect(v.result.current.rules.stage).toBe('unconfirmed');
  expect(v.result.current.rules.message).toContain('could not be checked');
});
