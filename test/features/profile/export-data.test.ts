import {
  buildExportEnvelope,
  EXPORT_VERSION,
  exportFileName,
  serializeExport,
  type ExportData,
} from '@/features/profile/lib/export-data';
import { describe, expect, it } from 'vitest';
import { salaryRow } from '../../helpers/salary-fixture';

const empty: ExportData = {
  profile: null,
  snapshots: [],
  expenses: [],
  salary: [],
  taxReliefs: [],
  trades: [],
  dividends: [],
  plannerSettings: null,
  scenarios: [],
  merchantRules: [],
  recurringTemplates: [],
};

describe('buildExportEnvelope', () => {
  it('wraps data with the version, app tag, and the given timestamp', () => {
    const env = buildExportEnvelope(empty, '2026-06-02T00:00:00.000Z');
    expect(env.version).toBe(EXPORT_VERSION);
    expect(env.app).toBe('fynfo');
    expect(env.exportedAt).toBe('2026-06-02T00:00:00.000Z');
  });

  it('carries all eleven personal domains through unchanged', () => {
    const data: ExportData = {
      ...empty,
      salary: [salaryRow('2026-01', 5000, 0)],
      taxReliefs: [{ year: 2026, reliefKey: 'cpf', amount: 1000 }],
    };
    const env = buildExportEnvelope(data, 'now');
    expect(Object.keys(env.data).sort()).toEqual([
      'dividends',
      'expenses',
      'merchantRules',
      'plannerSettings',
      'profile',
      'recurringTemplates',
      'salary',
      'scenarios',
      'snapshots',
      'taxReliefs',
      'trades',
    ]);
    expect(env.data.salary[0].salary).toBe(5000);
    expect(env.data.taxReliefs[0].year).toBe(2026);
  });
});

it('serializes income lines and re-reads them intact', () => {
  const month = salaryRow('2026-01', 5000, 1000);
  const env = buildExportEnvelope({ ...empty, salary: [month] }, 'now');
  const parsed = JSON.parse(serializeExport(env)) as typeof env;
  expect(parsed.data.salary[0].lines).toEqual(month.lines);
});

it('exports version 5 dividend values without loss', () => {
  const data: ExportData = {
    ...empty,
    dividends: [
      {
        id: 'd',
        ticker: 'ABC',
        date: '2026-01-01',

        amount: 12.34,
        currency: 'USD',
      },
    ],
  };
  const parsed = JSON.parse(serializeExport(buildExportEnvelope(data, 'now')));
  expect(parsed.version).toBe(5);
  expect(parsed.data.dividends).toEqual(data.dividends);
});

describe('serializeExport', () => {
  it('produces parseable pretty JSON that round-trips', () => {
    const env = buildExportEnvelope(empty, 'now');
    const json = serializeExport(env);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual(env);
  });
});

describe('exportFileName', () => {
  it('names the file with the YYYY-MM-DD date', () => {
    expect(exportFileName(new Date('2026-06-02T15:04:05.000Z'))).toBe(
      'fynfo-backup-2026-06-02.json'
    );
  });
});
