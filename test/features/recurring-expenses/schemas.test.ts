import {
  recurringDefinitionSchema,
  recurringMutationSchema,
  recurringPayloadSchema,
  recurringTemplatesSchema,
} from '@/features/recurring-expenses/schemas';
import { expect, it, vi } from 'vitest';
vi.mock('@/features/expenses', async () => ({
  EXPENSE_TYPE_LABELS: (await import('@/features/expenses/constants'))
    .EXPENSE_TYPE_LABELS,
}));
const uuid = (value: number) =>
  `13800000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const definition = {
  id: uuid(1),
  name: 'Synthetic bill',
  enabled: true,
  preferredDay: 31,
  startMonth: '2026-01',
  endMonth: null,
  cents: 100,
  category: 'bills',
  item: 'Synthetic item',
  info: '',
};
it.each([
  { name: '' },
  { name: ' '.repeat(3) },
  { name: 'x'.repeat(81) },
  { item: 'x'.repeat(257) },
  { info: 'x'.repeat(4097) },
  { cents: 0 },
  { cents: 1.5 },
  { cents: 1_000_000_000_001 },
  { category: 'toString' },
  { preferredDay: 32 },
  { preferredDay: 0 },
  { endMonth: '2025-12' },
  { startMonth: '2026-13' },
  { frequency: 'weekly' },
])('rejects unsupported template values %j', (change) => {
  expect(
    recurringDefinitionSchema.safeParse({ ...definition, ...change }).success
  ).toBe(false);
});
it('bounds archived templates too and never discards them to create capacity', () => {
  const templates = Array.from({ length: 51 }, (_, index) => ({
    definition: { ...definition, id: uuid(index + 1) },
    archived: true,
    occurrences: [],
  }));
  expect(recurringTemplatesSchema.safeParse(templates).success).toBe(false);
  expect(
    recurringTemplatesSchema.safeParse(templates.slice(0, 50)).success
  ).toBe(true);
});
it('bounds the combined retained history, including skipped occurrences', () => {
  const occurrences = Array.from({ length: 601 }, (_, index) => ({
    month: `${String(2000 + Math.floor(index / 12))}-${String((index % 12) + 1).padStart(2, '0')}`,
    requestId: uuid(100 + index),
    outcome: 'skipped',
    expense: null,
  }));
  const templates = [
    { definition, archived: false, occurrences },
    {
      definition: { ...definition, id: uuid(2) },
      archived: false,
      occurrences: occurrences.map((entry, index) => ({
        ...entry,
        requestId: uuid(1000 + index),
      })),
    },
  ];
  expect(recurringTemplatesSchema.safeParse(templates).success).toBe(false);
  templates[1].occurrences = templates[1].occurrences.slice(0, 599);
  expect(recurringTemplatesSchema.safeParse(templates).success).toBe(true);
});
it('bounds UTF-8 plaintext even within character-count and template-count limits', () => {
  const templates = Array.from({ length: 50 }, (_, index) => ({
    definition: { ...definition, id: uuid(index + 1), info: '界'.repeat(4096) },
    archived: true,
    occurrences: [],
  }));
  expect(recurringTemplatesSchema.safeParse(templates).success).toBe(true);
  expect(
    recurringPayloadSchema.safeParse({
      schemaVersion: 1,
      requestId: uuid(100),
      templates,
    }).success
  ).toBe(false);
});
it('allows no reset command, caller owner or numeric/lossy/overflow revision', () => {
  const input = {
    bookId: uuid(10),
    expectedRevision: '0',
    requestId: uuid(11),
    command: { kind: 'create', definition },
  };
  expect(recurringMutationSchema.safeParse(input).success).toBe(true);
  for (const change of [
    { command: { kind: 'reset', templateId: uuid(1) } },
    { owner: uuid(10) },
    { expectedRevision: 1 },
    { expectedRevision: '01' },
    { expectedRevision: '9223372036854775807' },
  ])
    expect(
      recurringMutationSchema.safeParse({ ...input, ...change }).success
    ).toBe(false);
});
