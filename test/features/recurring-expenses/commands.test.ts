import {
  applyRecurringCommand,
  recurringRequestRecorded,
} from '@/features/recurring-expenses/lib/commands';
import {
  recurringMutationSchema,
  recurringPayloadSchema,
} from '@/features/recurring-expenses/schemas';
import type {
  RecurringDefinition,
  RecurringMutation,
} from '@/features/recurring-expenses/types';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const definition: RecurringDefinition = {
  id: '13800000-0000-4000-8000-000000000001',
  name: 'Monthly bill',
  enabled: true,
  preferredDay: 31,
  startMonth: '2026-01',
  endMonth: null,
  cents: 5000,
  category: 'bills',
  item: 'Synthetic bill',
  info: 'Expected default',
};
const create: RecurringMutation = {
  bookId: '13800000-0000-4000-8000-000000000010',
  expectedRevision: '0',
  requestId: '13800000-0000-4000-8000-000000000011',
  command: { kind: 'create', definition },
};
const expense = {
  id: '13800000-0000-4000-8000-000000000012',
  date: '2026-03-01',
  category: 'bills' as const,
  item: 'Actual bill',
  info: 'Reviewed actual payment',
  cents: 5300,
};
const confirm: RecurringMutation = {
  ...create,
  expectedRevision: '1',
  requestId: '13800000-0000-4000-8000-000000000013',
  command: {
    kind: 'confirm',
    templateId: definition.id,
    month: '2026-02',
    expense,
  },
};
describe('explicit append-only recurring commands', () => {
  it('creates no occurrence when creating or editing a template', () => {
    const original = applyRecurringCommand(null, create, '2026-03-01');
    const edited = applyRecurringCommand(
      original,
      {
        ...create,
        expectedRevision: '1',
        command: { kind: 'edit', definition: { ...definition, cents: 5500 } },
      },
      '2026-03-01'
    );
    expect(edited.templates[0].occurrences).toEqual([]);
    expect(original.templates[0].definition.cents).toBe(5000);
  });
  it('records the intended month independently of an edited actual date and preserves frozen values', () => {
    const original = applyRecurringCommand(null, create, '2026-03-01');
    const saved = applyRecurringCommand(original, confirm, '2026-03-01');
    expect(saved.templates[0].occurrences[0]).toEqual({
      month: '2026-02',
      requestId: confirm.requestId,
      outcome: 'confirmed',
      expense,
    });
    expect(original.templates[0].occurrences).toEqual([]);
    const edited = applyRecurringCommand(
      saved,
      {
        ...create,
        expectedRevision: '2',
        command: { kind: 'edit', definition: { ...definition, cents: 100 } },
      },
      '2026-03-01'
    );
    expect(edited.templates[0].occurrences[0].expense?.cents).toBe(5300);
    expect(recurringRequestRecorded(confirm, edited)).toBe(true);
  });
  it('cannot confirm/skip a terminal occurrence again, including after hypothetical expense deletion', () => {
    const original = applyRecurringCommand(null, create, '2026-03-01');
    const saved = applyRecurringCommand(original, confirm, '2026-03-01');
    expect(() => applyRecurringCommand(saved, confirm, '2026-03-01')).toThrow();
    expect(() =>
      applyRecurringCommand(
        saved,
        {
          ...confirm,
          command: {
            kind: 'skip',
            templateId: definition.id,
            month: '2026-02',
          },
        },
        '2026-03-01'
      )
    ).toThrow();
    const skipped = applyRecurringCommand(
      original,
      {
        ...confirm,
        command: { kind: 'skip', templateId: definition.id, month: '2026-02' },
      },
      '2026-03-01'
    );
    expect(() =>
      applyRecurringCommand(skipped, confirm, '2026-03-01')
    ).toThrow();
  });
  it('rejects planned/disabled/archived/outside-window confirmations', () => {
    const original = applyRecurringCommand(null, create, '2026-02-27');
    expect(() =>
      applyRecurringCommand(original, confirm, '2026-02-27')
    ).toThrow();
    const archived = applyRecurringCommand(
      original,
      { ...confirm, command: { kind: 'archive', templateId: definition.id } },
      '2026-03-01'
    );
    expect(() =>
      applyRecurringCommand(archived, confirm, '2026-03-01')
    ).toThrow();
    expect(() =>
      applyRecurringCommand(
        original,
        {
          ...confirm,
          command: {
            ...confirm.command,
            kind: 'confirm',
            templateId: definition.id,
            month: '2025-12',
            expense,
          },
        },
        '2026-03-01'
      )
    ).toThrow();
  });
  it('archive preserves all receipts and cannot be silently unarchived by edit', () => {
    const saved = applyRecurringCommand(
      applyRecurringCommand(null, create, '2026-03-01'),
      confirm,
      '2026-03-01'
    );
    const archived = applyRecurringCommand(
      saved,
      { ...confirm, command: { kind: 'archive', templateId: definition.id } },
      '2026-03-01'
    );
    expect(archived.templates[0].occurrences).toEqual(
      saved.templates[0].occurrences
    );
    expect(() =>
      applyRecurringCommand(
        archived,
        { ...create, command: { kind: 'edit', definition } },
        '2026-03-01'
      )
    ).toThrow();
  });
  it('requires matching request identity and frozen values for receipt confirmation', () => {
    const saved = applyRecurringCommand(
      applyRecurringCommand(null, create, '2026-03-01'),
      confirm,
      '2026-03-01'
    );
    expect(recurringRequestRecorded(confirm, saved)).toBe(true);
    expect(
      recurringRequestRecorded(
        { ...confirm, requestId: create.requestId },
        saved
      )
    ).toBe(false);
    expect(
      recurringRequestRecorded(
        {
          ...confirm,
          command: {
            kind: 'confirm',
            templateId: definition.id,
            month: '2026-02',
            expense: { ...expense, cents: 999 },
          },
        },
        saved
      )
    ).toBe(false);
  });
  it('validates unique template/month/request/expense identities and supported inputs', () => {
    const saved = applyRecurringCommand(
      applyRecurringCommand(null, create, '2026-03-01'),
      confirm,
      '2026-03-01'
    );
    expect(
      recurringPayloadSchema.safeParse({
        ...saved,
        templates: [saved.templates[0], saved.templates[0]],
      }).success
    ).toBe(false);
    expect(
      recurringPayloadSchema.safeParse({
        ...saved,
        templates: [
          {
            ...saved.templates[0],
            occurrences: [
              ...saved.templates[0].occurrences,
              ...saved.templates[0].occurrences,
            ],
          },
        ],
      }).success
    ).toBe(false);
    expect(
      recurringMutationSchema.safeParse({ ...confirm, userId: 'other' }).success
    ).toBe(false);
    expect(
      recurringMutationSchema.safeParse({ ...confirm, expectedRevision: 1 })
        .success
    ).toBe(false);
    expect(
      recurringMutationSchema.safeParse({
        ...confirm,
        command: { ...confirm.command, expense: { ...expense, cents: -1 } },
      }).success
    ).toBe(false);
  });
});
