import {
  getRecurringRulebook,
  mutateRecurringRulebook,
} from '@/features/recurring-expenses/actions/recurring-actions';
import { applyRecurringCommand } from '@/features/recurring-expenses/lib/commands';
import type {
  RecurringMutation,
  RecurringPayload,
} from '@/features/recurring-expenses/types';
import { decryptPayload, encryptPayload } from '@/lib/crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { makeFakeSupabase } from '../../helpers/fake-supabase';

const mock = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('@/lib/action-guard', () => ({ requireActionContext: mock.context }));
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const key = Buffer.alloc(32, 8);
const bookId = '13800000-0000-4000-8000-000000000001';
const templateId = '13800000-0000-4000-8000-000000000002';
const requestId = '13800000-0000-4000-8000-000000000003';
const expenseId = '13800000-0000-4000-8000-000000000004';
const payload: RecurringPayload = {
  schemaVersion: 1,
  requestId: bookId,
  templates: [
    {
      archived: false,
      occurrences: [],
      definition: {
        id: templateId,
        name: 'Synthetic subscription',
        enabled: true,
        preferredDay: 1,
        startMonth: '2000-01',
        endMonth: null,
        cents: 1999,
        category: 'subscriptions',
        item: 'Synthetic service',
        info: 'Synthetic note',
      },
    },
  ],
};
const input: RecurringMutation = {
  bookId,
  expectedRevision: '1',
  requestId,
  command: {
    kind: 'confirm',
    templateId,
    month: '2000-01',
    expense: {
      id: expenseId,
      date: '2000-02-03',
      category: 'subscriptions',
      item: 'Actual synthetic service',
      info: 'Reviewed',
      cents: 2050,
    },
  },
};
function setup(options: Parameters<typeof makeFakeSupabase>[0] = {}) {
  const fake = makeFakeSupabase({
    selectData: {
      id: bookId,
      revision: '1',
      payload: encryptPayload(JSON.stringify(payload), key),
    },
    rpcData: {
      compare_save_personal_recurring_rulebook: [
        { status: 'SAVED', revision: '2' },
      ],
    },
    ...options,
  });
  mock.context.mockResolvedValue({
    userId: 'synthetic-owner',
    dek: key,
    supabase: fake.client,
  });
  return fake;
}
beforeEach(() => vi.clearAllMocks());

it('saves an encrypted receipt and self-expense in one RPC without direct writes or caller owner', async () => {
  const fake = setup();
  expect(await mutateRecurringRulebook(input)).toEqual({ status: 'saved' });
  const args = fake.calls.rpc[0].args as {
    p_id: string;
    p_expected_revision: string;
    p_payload: string;
    p_expense: Record<string, string>;
  };
  expect(Object.keys(args).sort()).toEqual([
    'p_expected_revision',
    'p_expense',
    'p_id',
    'p_payload',
  ]);
  expect(args.p_expected_revision).toBe('1');
  const next = JSON.parse(
    decryptPayload(args.p_payload, key)
  ) as RecurringPayload;
  expect(next.templates[0].occurrences[0]).toEqual({
    month: '2000-01',
    requestId,
    outcome: 'confirmed',
    expense: input.command.kind === 'confirm' ? input.command.expense : null,
  });
  expect(args.p_expense.date).toBe('2000-02-03');
  expect(decryptPayload(args.p_expense.amount, key)).toBe('20.5');
  expect(decryptPayload(args.p_expense.item, key)).toBe(
    'Actual synthetic service'
  );
  expect(decryptPayload(args.p_expense.info, key)).toBe('Reviewed');
  expect(fake.calls.insert).toHaveLength(0);
  expect(fake.calls.update).toHaveLength(0);
  expect(fake.calls.queries[0].eq).toEqual([
    { column: 'user_id', value: 'synthetic-owner' },
  ]);
});
it('creates no expense for explicit create, edit, archive or skip', async () => {
  for (const command of [
    {
      kind: 'create',
      definition: { ...payload.templates[0].definition, id: expenseId },
    },
    {
      kind: 'edit',
      definition: { ...payload.templates[0].definition, name: 'Edited' },
    },
    { kind: 'archive', templateId },
    { kind: 'skip', templateId, month: '2000-01' },
  ] as const) {
    const fake = setup();
    expect(await mutateRecurringRulebook({ ...input, command })).toEqual({
      status: 'saved',
    });
    expect(fake.calls.rpc[0].args).toHaveProperty('p_expense', null);
  }
});
it('uses lossless revisions above the JS safe-integer bound', async () => {
  const fake = setup({
    selectData: {
      id: bookId,
      revision: '9007199254740993',
      payload: encryptPayload(JSON.stringify(payload), key),
    },
    rpcData: {
      compare_save_personal_recurring_rulebook: [
        { status: 'SAVED', revision: '9007199254740994' },
      ],
    },
  });
  expect(
    await mutateRecurringRulebook({
      ...input,
      expectedRevision: '9007199254740993',
    })
  ).toEqual({ status: 'saved' });
  expect(fake.calls.rpc[0].args).toHaveProperty(
    'p_expected_revision',
    '9007199254740993'
  );
});
it('recognizes retained receipt after later edits without resending an expense', async () => {
  const saved = applyRecurringCommand(payload, input, '2000-03-01');
  saved.requestId = expenseId;
  saved.templates[0].definition.name = 'Later name';
  const fake = setup({
    selectData: {
      id: bookId,
      revision: '50',
      payload: encryptPayload(JSON.stringify(saved), key),
    },
  });
  expect(await mutateRecurringRulebook(input)).toEqual({ status: 'saved' });
  expect(fake.calls.rpc).toHaveLength(0);
});
it('rejects stale revisions, foreign incarnation, absent template and future occurrences', async () => {
  for (const change of [
    { expectedRevision: '0' },
    { bookId: expenseId },
    { command: { ...input.command, month: '9999-01' } },
    { command: { kind: 'skip', templateId: expenseId, month: '2000-01' } },
  ]) {
    const fake = setup();
    expect(
      (await mutateRecurringRulebook({ ...input, ...change })).status
    ).not.toBe('saved');
    expect(fake.calls.rpc).toHaveLength(0);
  }
});
it('cannot confirm an already skipped occurrence even at the fresh revision', async () => {
  const skipped = applyRecurringCommand(
    payload,
    { ...input, command: { kind: 'skip', templateId, month: '2000-01' } },
    '2000-03-01'
  );
  const fake = setup({
    selectData: {
      id: bookId,
      revision: '2',
      payload: encryptPayload(JSON.stringify(skipped), key),
    },
  });
  expect(
    await mutateRecurringRulebook({ ...input, expectedRevision: '2' })
  ).toEqual({ status: 'not_saved' });
  expect(fake.calls.rpc).toHaveLength(0);
});
it('distinguishes absent book and rejects invalid decrypted data', async () => {
  setup({ selectData: null });
  expect(await getRecurringRulebook()).toBeNull();
  for (const encrypted of [
    'broken',
    encryptPayload(JSON.stringify({ ...payload, schemaVersion: 2 }), key),
    encryptPayload('x'.repeat(524289), key),
  ]) {
    setup({ selectData: { id: bookId, revision: '1', payload: encrypted } });
    await expect(getRecurringRulebook()).rejects.toThrow(
      'Recurring templates could not be read'
    );
  }
});
it('requires identity/vault before reading or writing', async () => {
  const fake = setup();
  mock.context.mockRejectedValue(new Error('locked'));
  expect(await mutateRecurringRulebook(input)).toEqual({ status: 'not_saved' });
  await expect(getRecurringRulebook()).rejects.toThrow('locked');
  expect(fake.calls.from).toHaveLength(0);
  expect(fake.calls.rpc).toHaveLength(0);
});
it.each([
  null,
  [],
  [{ status: 'SAVED', revision: '3' }],
  [{ status: 'SAVED', revision: 2 }],
])('keeps a malformed acknowledgement unconfirmed', async (data) => {
  setup({ rpcData: { compare_save_personal_recurring_rulebook: data } });
  expect(await mutateRecurringRulebook(input)).toEqual({
    status: 'unconfirmed',
  });
});
it('does not expose SQL errors or claim rollback after dispatch', async () => {
  setup({
    rpcError: {
      compare_save_personal_recurring_rulebook: {
        message: 'private database detail',
      },
    },
  });
  expect(await mutateRecurringRulebook(input)).toEqual({
    status: 'unconfirmed',
  });
});
it('rejects unknown fields and malformed inputs before accessing data', async () => {
  const fake = setup();
  expect(
    await mutateRecurringRulebook({ ...input, user_id: 'someone' })
  ).toEqual({ status: 'not_saved' });
  expect(mock.context).not.toHaveBeenCalled();
  expect(fake.calls.from).toHaveLength(0);
});
it('permits absent-book creation only and resolves SQL conflicts with an authoritative receipt read', async () => {
  const fake = setup({
    selectData: null,
    rpcData: {
      compare_save_personal_recurring_rulebook: [
        { status: 'SAVED', revision: '1' },
      ],
    },
  });
  expect(
    await mutateRecurringRulebook({
      ...input,
      expectedRevision: '0',
      command: { kind: 'create', definition: payload.templates[0].definition },
    })
  ).toEqual({ status: 'saved' });
  expect(fake.calls.rpc[0].args).toHaveProperty('p_expense', null);
  setup({ selectData: null });
  expect(await mutateRecurringRulebook(input)).toEqual({ status: 'conflict' });
  setup({
    rpcData: {
      compare_save_personal_recurring_rulebook: [
        { status: 'CONFLICT', revision: null },
      ],
    },
  });
  expect(await mutateRecurringRulebook(input)).toEqual({ status: 'conflict' });
});
