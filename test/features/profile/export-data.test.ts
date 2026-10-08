import {
  buildExportEnvelope,
  EXPORT_VERSION,
  exportFileName,
  serializeExport,
  type ExportData,
} from '@/features/profile/lib/export-data';
import { describe, expect, it } from 'vitest';

const empty: ExportData = {
  profile: null,
  snapshots: [],
  expenses: [],
  salary: [],
  taxReliefs: [],
  trades: [],
  dividends: [],
  plannerSettings: null,
};

describe('buildExportEnvelope', () => {
  it('wraps data with the version, app tag, and the given timestamp', () => {
    const env = buildExportEnvelope(empty, '2026-06-02T00:00:00.000Z');
    expect(env.version).toBe(EXPORT_VERSION);
    expect(env.app).toBe('fynfo');
    expect(env.exportedAt).toBe('2026-06-02T00:00:00.000Z');
  });

  it('carries all eight personal domains through unchanged', () => {
    const data: ExportData = {
      ...empty,
      salary: [{ id: '2026-01', salary: 5000, bonus: 0 }],
      taxReliefs: [{ year: 2026, reliefKey: 'cpf', amount: 1000 }],
    };
    const env = buildExportEnvelope(data, 'now');
    expect(Object.keys(env.data).sort()).toEqual([
      'dividends',
      'expenses',
      'plannerSettings',
      'profile',
      'salary',
      'snapshots',
      'taxReliefs',
      'trades',
    ]);
    expect(env.data.salary[0].salary).toBe(5000);
    expect(env.data.taxReliefs[0].year).toBe(2026);
  });
});

it('exports version 2 dividend values without loss', () => {
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
  expect(parsed.version).toBe(2);
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
