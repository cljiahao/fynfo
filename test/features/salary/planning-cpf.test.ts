import { calculateMonthlyCpfForPlanning } from '@/features/salary/lib/tax-cpf';
import { describe, expect, it } from 'vitest';

describe('calculateMonthlyCpfForPlanning', () => {
  it('caps employee CPF at the 2026 ordinary wage ceiling', () => {
    expect(calculateMonthlyCpfForPlanning(7999, 2026, 6)).toBe(1599);
    expect(calculateMonthlyCpfForPlanning(8000, 2026, 6)).toBe(1600);
    expect(calculateMonthlyCpfForPlanning(12000, 2026, 6)).toBe(1600);
  });

  it('switches ceilings at year and September-2023 boundaries', () => {
    expect(calculateMonthlyCpfForPlanning(20000, 2025, 12)).toBe(1480);
    expect(calculateMonthlyCpfForPlanning(20000, 2026, 1)).toBe(1600);
    expect(calculateMonthlyCpfForPlanning(20000, 2023, 8)).toBe(1200);
    expect(calculateMonthlyCpfForPlanning(20000, 2023, 9)).toBe(1260);
  });

  it('falls back to the newest ceiling for years past the table', () => {
    expect(calculateMonthlyCpfForPlanning(12000, 2031, 3)).toBe(1600);
  });

  it('is null before the table and never negative for tiny pay', () => {
    expect(calculateMonthlyCpfForPlanning(5000, 2020, 1)).toBeNull();
    expect(calculateMonthlyCpfForPlanning(0, 2026, 1)).toBe(0);
    expect(calculateMonthlyCpfForPlanning(500, 2026, 1)).toBeGreaterThanOrEqual(
      0
    );
  });
});
