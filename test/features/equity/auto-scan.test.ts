import { shouldAutoScan } from '@/features/equity/lib/auto-scan';
import { describe, expect, it } from 'vitest';

const HOUR_MS = 3_600_000;
const NOW = Date.parse('2026-06-01T12:00:00.000Z');

describe('shouldAutoScan', () => {
  it('scans when no scan has completed on this device', () => {
    expect(shouldAutoScan(null, NOW)).toBe(true);
  });
  it('skips a scan completed 23 hours ago', () => {
    expect(
      shouldAutoScan(new Date(NOW - 23 * HOUR_MS).toISOString(), NOW)
    ).toBe(false);
  });
  it('scans again after 25 hours', () => {
    expect(
      shouldAutoScan(new Date(NOW - 25 * HOUR_MS).toISOString(), NOW)
    ).toBe(true);
  });
  it('treats a corrupt timestamp as never scanned', () => {
    expect(shouldAutoScan('not-a-date', NOW)).toBe(true);
    expect(shouldAutoScan('', NOW)).toBe(true);
  });
});
