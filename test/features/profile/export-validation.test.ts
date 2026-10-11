import { EXPORT_REVIEW_MAX_BYTES } from '@/features/profile/lib/export-review-constants';
import { reviewExportJson } from '@/features/profile/lib/export-validation';
import { guardReviewJson } from '@/features/profile/lib/json-review-guard';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixture = readFileSync(
  resolve('docs/audit/pdf-import-fixtures/export-v3-synthetic.json'),
  'utf8'
);
function sample() {
  return JSON.parse(fixture) as {
    version: number;
    app: string;
    exportedAt: string;
    data: {
      profile: {
        birthYear: number | null;
        isNsman: boolean;
        residencyStatus: string;
      } | null;
      snapshots: {
        id: string;
        entries: { category: string; account: string; amount: number }[];
      }[];
      expenses: {
        id: string;
        date: string;
        type: string;
        item: string;
        info: string;
        amount: number;
        splitType: string;
        splits: { person: string; amount: number; settled: boolean }[];
      }[];
      salary: { id: string; salary: number; bonus: number }[];
      taxReliefs: { year: number; reliefKey: string; amount: number }[];
      trades: {
        id?: string;
        date: string;
        broker: string;
        ticker: string;
        action: string;
        shares: number;
        price: number;
        fees: number;
        isCdp?: boolean;
        isPO?: boolean;
      }[];
      dividends?: {
        id?: string;
        date: string;
        ticker: string;
        amount: number;
        currency: string;
      }[];
      plannerSettings: {
        emergencyMonths: number;
        warChestMonths: number;
        titheEnabled: boolean;
        tithePct: number;
        allowanceEnabled: boolean;
        allowancePct: number;
      } | null;
      scenarios?: {
        id: string;
        creationRequestId: string;
        revision: string;
        createdAt: string;
        updatedAt: string;
        payload: {
          schemaVersion: number;
          name: string;
          model: string;
          currency: string;
          capturedAt: string;
          sourceSnapshotMonth?: string;
          inputs: {
            salary: number;
            expenses: number;
            emergencyMonths: number;
            warChestMonths: number;
            titheEnabled: boolean;
            tithePctInput: number;
            allowanceEnabled: boolean;
            allowancePctInput: number;
            currentSavings: number;
            currentBonds: number;
          };
        };
      }[];
    };
  };
}
type Fixture = ReturnType<typeof sample>;
function review(mutator: (file: Fixture) => void) {
  const file = sample();
  mutator(file);
  return reviewExportJson(JSON.stringify(file));
}

describe('local export read contract', () => {
  it('summarizes all nine nonempty domains without returning confidential values', () => {
    const result = reviewExportJson(fixture);
    expect(result).toEqual({
      ok: true,
      summary: {
        version: 3,
        exportedAt: '2026-10-11T08:00:00.000Z',
        counts: {
          profile: 1,
          snapshots: 1,
          expenses: 1,
          salary: 1,
          taxReliefs: 1,
          trades: 1,
          dividends: 1,
          plannerSettings: 1,
          scenarios: 1,
        },
        warnings: [],
      },
    });
    expect(JSON.stringify(result)).not.toContain('Synthetic');
    expect(JSON.stringify(result)).not.toContain('1234.56');
  });
  it.each([1, 2])('marks absent legacy domains for version %s', (version) => {
    const result = review((file) => {
      file.version = version;
      delete file.data.scenarios;
      if (version === 1) delete file.data.dividends;
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.counts.scenarios).toBeNull();
      expect(result.summary.counts.dividends).toBe(version === 1 ? null : 1);
      expect(result.summary.warnings.length).toBe(version === 1 ? 2 : 1);
    }
  });
  it('supports null singleton domains and empty arrays', () => {
    const result = review((file) => {
      file.data.profile = null;
      file.data.plannerSettings = null;
      file.data.snapshots = [];
      file.data.expenses = [];
      file.data.salary = [];
      file.data.taxReliefs = [];
      file.data.trades = [];
      file.data.dividends = [];
      file.data.scenarios = [];
    });
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(Object.values(result.summary.counts)).toEqual(Array(9).fill(0));
  });
  it('preserves supported whitespace, optional trade IDs, decimal and year-zero month values', () => {
    const file = sample();
    file.data.snapshots[0].id = '0000-01';
    file.data.snapshots[0].entries[0].account = '  Synthetic  ';
    file.data.expenses[0].info = '  Unicode café 😀  ';
    file.data.expenses[0].amount = 30.251;
    delete file.data.trades[0].id;
    delete file.data.dividends?.[0].id;
    const content = JSON.stringify(file);
    expect(reviewExportJson(content).ok).toBe(true);
    expect(JSON.stringify(file)).toBe(content);
  });
  it.each([
    [
      'future version',
      (f: Fixture) => {
        f.version = 4;
      },
    ],
    [
      'wrong app',
      (f: Fixture) => {
        f.app = 'other';
      },
    ],
    [
      'missing current scenarios',
      (f: Fixture) => {
        delete f.data.scenarios;
      },
    ],
    [
      'missing current dividends',
      (f: Fixture) => {
        delete f.data.dividends;
      },
    ],
    [
      'invalid export timestamp',
      (f: Fixture) => {
        f.exportedAt = '2026-02-30T00:00:00Z';
      },
    ],
    [
      'invalid record date',
      (f: Fixture) => {
        f.data.expenses[0].date = '2026-02-30';
      },
    ],
    [
      'invalid timestamp suffix',
      (f: Fixture) => {
        f.data.trades[0].date = '2026-09-01Tjunk';
      },
    ],
    [
      'negative expense',
      (f: Fixture) => {
        f.data.expenses[0].amount = -1;
      },
    ],
    [
      'unknown expense type',
      (f: Fixture) => {
        f.data.expenses[0].type = 'unknown';
      },
    ],
    [
      'overflow shared allocation',
      (f: Fixture) => {
        f.data.expenses[0].splits[0].amount = 31;
      },
    ],
    [
      'unsafe shared cents',
      (f: Fixture) => {
        f.data.expenses[0].amount = 1e20;
      },
    ],
    [
      'self expense with stale splits',
      (f: Fixture) => {
        f.data.expenses[0].splitType = 'self';
      },
    ],
    [
      'invalid currency',
      (f: Fixture) => {
        f.data.dividends![0].currency = 'EUR';
      },
    ],
    [
      'ticker transform needed',
      (f: Fixture) => {
        f.data.trades[0].ticker = ' d05.si ';
      },
    ],
    [
      'scenario name transform needed',
      (f: Fixture) => {
        f.data.scenarios![0].payload.name = ' Synthetic ';
      },
    ],
    [
      'scenario upper revision bound',
      (f: Fixture) => {
        f.data.scenarios![0].revision = '9223372036854775808';
      },
    ],
    [
      'scenario zero revision',
      (f: Fixture) => {
        f.data.scenarios![0].revision = '0';
      },
    ],
    [
      'scenario input bound',
      (f: Fixture) => {
        f.data.scenarios![0].payload.inputs.salary = 1e10;
      },
    ],
    [
      'oversize general string',
      (f: Fixture) => {
        f.data.expenses[0].info = 'x'.repeat(4097);
      },
    ],
    [
      'duplicate expense',
      (f: Fixture) => {
        f.data.expenses.push(f.data.expenses[0]);
      },
    ],
    [
      'duplicate snapshot month',
      (f: Fixture) => {
        f.data.snapshots.push(f.data.snapshots[0]);
      },
    ],
    [
      'duplicate salary month',
      (f: Fixture) => {
        f.data.salary.push(f.data.salary[0]);
      },
    ],
    [
      'duplicate relief identity',
      (f: Fixture) => {
        f.data.taxReliefs.push(f.data.taxReliefs[0]);
      },
    ],
    [
      'duplicate trade identity',
      (f: Fixture) => {
        f.data.trades.push(f.data.trades[0]);
      },
    ],
    [
      'duplicate dividend identity',
      (f: Fixture) => {
        f.data.dividends!.push(f.data.dividends![0]);
      },
    ],
    [
      'duplicate scenario ID',
      (f: Fixture) => {
        f.data.scenarios!.push({
          ...f.data.scenarios![0],
          creationRequestId: '20000000-0000-4000-8000-000000000001',
        });
      },
    ],
    [
      'duplicate scenario request ID',
      (f: Fixture) => {
        f.data.scenarios!.push({
          ...f.data.scenarios![0],
          id: '20000000-0000-4000-8000-000000000001',
        });
      },
    ],
    [
      'scenario capacity',
      (f: Fixture) => {
        f.data.scenarios = Array(11).fill(f.data.scenarios![0]);
      },
    ],
  ])('rejects %s', (_name, mutate) => {
    expect(review(mutate).ok).toBe(false);
  });
  it('does not disclose unknown field names or values in diagnostics', () => {
    const file = JSON.parse(fixture) as Record<string, unknown>;
    file['SYNTHETIC-SECRET-NAME'] = 'SYNTHETIC-SECRET-VALUE';
    const result = reviewExportJson(JSON.stringify(file));
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC-SECRET');
  });
  it('accepts same relief key in another year and equal trades without IDs', () => {
    expect(
      review((f) => {
        f.data.taxReliefs.push({ ...f.data.taxReliefs[0], year: 2025 });
        delete f.data.trades[0].id;
        f.data.trades.push({ ...f.data.trades[0] });
      }).ok
    ).toBe(true);
  });
  it('counts nested rows at the limit and rejects one extra', () => {
    const file = sample();
    file.data.snapshots[0].entries = Array.from({ length: 9990 }, () => ({
      category: 'savings',
      account: '',
      amount: 0,
    }));
    expect(reviewExportJson(JSON.stringify(file)).ok).toBe(true);
    file.data.snapshots[0].entries.push({
      category: 'savings',
      account: '',
      amount: 0,
    });
    expect(reviewExportJson(JSON.stringify(file)).ok).toBe(false);
  });
  it('bounds bytes before parsing, including multibyte UTF-8', () => {
    expect(reviewExportJson(' '.repeat(EXPORT_REVIEW_MAX_BYTES + 1)).ok).toBe(
      false
    );
    expect(
      reviewExportJson('😀'.repeat(EXPORT_REVIEW_MAX_BYTES / 4 + 1))
    ).toMatchObject({ ok: false, error: expect.stringContaining('1 MiB') });
  });
  it('rejects numeric overflow rather than treating it as a finite amount', () => {
    expect(reviewExportJson(fixture.replace('1234.56', '1e400')).ok).toBe(
      false
    );
  });
});

describe('JSON ambiguity and depth guard', () => {
  it.each([
    '{"app":"fynfo","app":"other"}',
    '{"app":1,"\\u0061pp":2}',
    '{"x":{"key":1,"key":2}}',
    '{"x":[{"a":1,"a":2}]}',
  ])('rejects repeated object keys: %s', (text) => {
    expect(() => guardReviewJson(text)).toThrow();
  });
  it('allows repeated keys in independent objects and punctuation/escaped quotes in strings', () => {
    expect(() => guardReviewJson('[{"a":"\\\"{,}"},{"a":1}]')).not.toThrow();
  });
  it('accepts 32 nested containers and rejects 33', () => {
    expect(() =>
      guardReviewJson('['.repeat(32) + '0' + ']'.repeat(32))
    ).not.toThrow();
    expect(() =>
      guardReviewJson('['.repeat(33) + '0' + ']'.repeat(33))
    ).toThrow();
  });
  it.each(['', '{', '{"app":', '{"app":"unterminated}', 'null', '[]'])(
    'fails malformed/unsupported envelope: %s',
    (content) => {
      expect(reviewExportJson(content).ok).toBe(false);
    }
  );
});
