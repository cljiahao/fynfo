import { merchantRulesSchema } from '@/features/merchant-rules';
import { z } from 'zod';
import {
  EXPORT_REVIEW_DOMAINS,
  EXPORT_REVIEW_MAX_BYTES,
  EXPORT_REVIEW_MAX_ROWS,
  EXPORT_REVIEW_MAX_STRING,
  EXPORT_REVIEW_WARNINGS,
  type ExportReviewDomain,
} from './export-review-constants';
import { guardReviewJson } from './json-review-guard';

const text = z.string().max(EXPORT_REVIEW_MAX_STRING);
const identity = text.min(1);
const amount = z.number().finite().nonnegative();
const positive = z.number().finite().positive();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const timestamp = z.iso.datetime({ offset: true });
const date = z.union([z.iso.date(), timestamp]);
const ticker = z.string().regex(/^[A-Z0-9.\-:]{1,16}$/);
const percentage = amount.max(100);
const rowList = <T extends z.ZodType>(schema: T) =>
  z.array(schema).max(EXPORT_REVIEW_MAX_ROWS);

// These read contracts deliberately do not transform or strip exported values.
const profile = z.strictObject({
  birthYear: z.number().int().min(1940).max(9999).nullable(),
  isNsman: z.boolean(),
  residencyStatus: z.enum(['resident', 'non_resident']),
});
const snapshot = z.strictObject({
  id: month,
  entries: rowList(
    z.strictObject({
      category: z.enum([
        'savings',
        'bonds',
        'stocks',
        'etf',
        'non_equity',
        'crypto',
        'pension',
      ]),
      account: text,
      amount,
    })
  ),
});
const expense = z
  .strictObject({
    id: identity,
    date,
    type: z.enum([
      'bills',
      'charity',
      'electronics',
      'entertainment',
      'food_drink',
      'gift',
      'groceries',
      'health',
      'insurance',
      'other',
      'shopping',
      'subscriptions',
      'transport',
      'travel',
    ]),
    item: text,
    info: text,
    amount: positive,
    splitType: z.enum(['self', 'shared']),
    splits: rowList(
      z.strictObject({ person: identity, amount, settled: z.boolean() })
    ),
  })
  .refine((row) => {
    if (row.splitType === 'self') return row.splits.length === 0;
    const cents = Math.round(row.amount * 100);
    const shares = row.splits.map((split) => Math.round(split.amount * 100));
    const total = shares.reduce((sum, share) => sum + share, 0);
    return (
      Number.isSafeInteger(cents) &&
      shares.every(Number.isSafeInteger) &&
      Number.isSafeInteger(total) &&
      total <= cents
    );
  }, 'Invalid expense split allocation.');
const salary = z.strictObject({ id: month, salary: amount, bonus: amount });
const relief = z.strictObject({
  year: z.number().int().min(0).max(9999),
  reliefKey: identity,
  amount,
});
const trade = z.strictObject({
  id: identity.optional(),
  date,
  broker: text.min(1).max(64),
  ticker,
  action: z.enum(['buy', 'sell']),
  shares: positive,
  price: positive,
  fees: amount,
  isCdp: z.boolean().optional(),
  isPO: z.boolean().optional(),
});
const dividend = z.strictObject({
  id: identity.optional(),
  date,
  ticker,
  amount: positive,
  currency: z.enum(['SGD', 'USD']),
});
const planner = z.strictObject({
  emergencyMonths: amount,
  warChestMonths: amount,
  titheEnabled: z.boolean(),
  tithePct: percentage,
  allowanceEnabled: z.boolean(),
  allowancePct: percentage,
});
const scenarioPayload = z
  .strictObject({
    schemaVersion: z.literal(1),
    name: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => value.trim() === value),
    model: z.literal('allocation-flat-cpf-v1'),
    currency: z.literal('SGD'),
    capturedAt: z.iso.datetime(),
    sourceSnapshotMonth: month.optional(),
    inputs: z.strictObject({
      salary: amount.max(1e9),
      expenses: amount.max(1e9),
      emergencyMonths: amount.max(120),
      warChestMonths: amount.max(120),
      titheEnabled: z.boolean(),
      tithePctInput: percentage,
      allowanceEnabled: z.boolean(),
      allowancePctInput: percentage,
      currentSavings: z.number().finite().min(-1e9).max(1e9),
      currentBonds: z.number().finite().min(-1e9).max(1e9),
    }),
  })
  .refine(
    (value) => new TextEncoder().encode(JSON.stringify(value)).length <= 8192
  );
const scenario = z.strictObject({
  id: z.uuid(),
  creationRequestId: z.uuid(),
  revision: z
    .string()
    .regex(/^[1-9]\d{0,18}$/)
    .refine((value) => value.length < 19 || value <= '9223372036854775807'),
  createdAt: timestamp,
  updatedAt: timestamp,
  payload: scenarioPayload,
});
const common = {
  profile: profile.nullable(),
  snapshots: rowList(snapshot),
  expenses: rowList(expense),
  salary: rowList(salary),
  taxReliefs: rowList(relief),
  trades: rowList(trade),
  plannerSettings: planner.nullable(),
};
const envelope = z.discriminatedUnion('version', [
  z.strictObject({
    version: z.literal(1),
    app: z.literal('fynfo'),
    exportedAt: timestamp,
    data: z.strictObject(common),
  }),
  z.strictObject({
    version: z.literal(2),
    app: z.literal('fynfo'),
    exportedAt: timestamp,
    data: z.strictObject({ ...common, dividends: rowList(dividend) }),
  }),
  z.strictObject({
    version: z.literal(3),
    app: z.literal('fynfo'),
    exportedAt: timestamp,
    data: z.strictObject({
      ...common,
      dividends: rowList(dividend),
      scenarios: z.array(scenario).max(10),
    }),
  }),
  z.strictObject({
    version: z.literal(4),
    app: z.literal('fynfo'),
    exportedAt: timestamp,
    data: z.strictObject({
      ...common,
      dividends: rowList(dividend),
      scenarios: z.array(scenario).max(10),
      merchantRules: merchantRulesSchema,
    }),
  }),
]);

export interface ExportReviewSummary {
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  counts: Record<ExportReviewDomain, number | null>;
  warnings: string[];
}
export type ExportReviewResult =
  | { ok: true; summary: ExportReviewSummary }
  | { ok: false; error: string };

function hasDuplicates(values: (string | undefined)[]): boolean {
  const present = values.filter((value) => value !== undefined);
  return new Set(present).size !== present.length;
}

/** Inspect transient plaintext locally. Return only counts and fixed diagnostics;
 * never the file, financial rows, values, or arbitrary untrusted field names. */
export function reviewExportJson(content: string): ExportReviewResult {
  if (new TextEncoder().encode(content).length > EXPORT_REVIEW_MAX_BYTES)
    return {
      ok: false,
      error:
        'This file exceeds the 1 MiB local review limit. Choose a smaller export; the original file is unchanged.',
    };
  let parsed: unknown;
  try {
    guardReviewJson(content);
    parsed = JSON.parse(content);
  } catch {
    return {
      ok: false,
      error:
        'The file is not unambiguous JSON within the 32-level nesting limit. Choose an original Fynfo JSON export.',
    };
  }
  const result = envelope.safeParse(parsed);
  if (!result.success) {
    const issueDomain = result.error.issues.find(
      (issue) =>
        issue.path[0] === 'data' &&
        EXPORT_REVIEW_DOMAINS.some((domain) => domain.key === issue.path[1])
    );
    const label = EXPORT_REVIEW_DOMAINS.find(
      (domain) => domain.key === issueDomain?.path[1]
    )?.label;
    return {
      ok: false,
      error: label
        ? `${label} contains unsupported or invalid fields. Check that domain in the original export; no records were changed.`
        : 'This file does not match a supported Fynfo export (versions 1–4). Check its version and required fields; no records were changed.',
    };
  }
  const { data, version, exportedAt } = result.data;
  const dividends = 'dividends' in data ? data.dividends : [];
  const scenarios = 'scenarios' in data ? data.scenarios : [];
  const merchantRules = 'merchantRules' in data ? data.merchantRules : [];
  const counts: ExportReviewSummary['counts'] = {
    profile: data.profile === null ? 0 : 1,
    snapshots: data.snapshots.length,
    expenses: data.expenses.length,
    salary: data.salary.length,
    taxReliefs: data.taxReliefs.length,
    trades: data.trades.length,
    dividends: version === 1 ? null : dividends.length,
    plannerSettings: data.plannerSettings === null ? 0 : 1,
    scenarios: version < 3 ? null : scenarios.length,
    merchantRules: version < 4 ? null : merchantRules.length,
  };
  const rows =
    Object.values(counts).reduce<number>(
      (sum, count) => sum + (count ?? 0),
      0
    ) +
    data.snapshots.reduce((sum, row) => sum + row.entries.length, 0) +
    data.expenses.reduce((sum, row) => sum + row.splits.length, 0);
  if (rows > EXPORT_REVIEW_MAX_ROWS)
    return {
      ok: false,
      error:
        'This file exceeds the 10,000-row local review limit, including nested entries and splits. The original file is unchanged.',
    };
  const duplicateDomains = [
    ['Snapshots', data.snapshots.map((row) => row.id)],
    ['Expenses', data.expenses.map((row) => row.id)],
    ['Salary', data.salary.map((row) => row.id)],
    [
      'Tax reliefs',
      data.taxReliefs.map((row) => JSON.stringify([row.year, row.reliefKey])),
    ],
    ['Trades', data.trades.map((row) => row.id)],
    ['Dividends', dividends.map((row) => row.id)],
    ['Saved planning scenarios', scenarios.map((row) => row.id)],
    ['Saved planning scenarios', scenarios.map((row) => row.creationRequestId)],
  ] as const;
  for (const [label, ids] of duplicateDomains) {
    if (hasDuplicates([...ids]))
      return {
        ok: false,
        error: `${label} contains repeated record identities. Review the original export; no records were changed.`,
      };
  }
  const warnings: string[] = [];
  if (version === 1) warnings.push(EXPORT_REVIEW_WARNINGS.dividends);
  if (version < 3) warnings.push(EXPORT_REVIEW_WARNINGS.scenarios);
  if (version < 4) warnings.push(EXPORT_REVIEW_WARNINGS.merchantRules);
  return { ok: true, summary: { version, exportedAt, counts, warnings } };
}
