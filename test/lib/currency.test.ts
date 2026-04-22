import {
  formatCurrency,
  formatSGD,
  formatSGDWhole,
  formatUSD,
} from '@/lib/utils/currency';
import { describe, expect, it } from 'vitest';

// Currency symbols vary by ICU data / Node version; use the runtime's own output as the reference.
const sgdSymbol = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  minimumFractionDigits: 2,
})
  .format(0)
  .replace(/[\d,.\s]/g, '');

describe('formatSGD', () => {
  it('formats positive values with 2 decimal places', () => {
    expect(formatSGD(1234.5)).toBe(`${sgdSymbol}1,234.50`);
  });

  it('formats zero', () => {
    expect(formatSGD(0)).toBe(`${sgdSymbol}0.00`);
  });

  it('formats negative values', () => {
    expect(formatSGD(-500)).toBe(`-${sgdSymbol}500.00`);
  });

  it('formats large values with thousands separator', () => {
    expect(formatSGD(1000000)).toBe(`${sgdSymbol}1,000,000.00`);
  });
});

describe('formatSGDWhole', () => {
  it('formats values with no decimal places', () => {
    expect(formatSGDWhole(1234.56)).toBe(`${sgdSymbol}1,235`);
  });

  it('rounds down correctly', () => {
    expect(formatSGDWhole(1234.4)).toBe(`${sgdSymbol}1,234`);
  });

  it('formats zero', () => {
    expect(formatSGDWhole(0)).toBe(`${sgdSymbol}0`);
  });

  it('formats large values', () => {
    expect(formatSGDWhole(50000)).toBe(`${sgdSymbol}50,000`);
  });
});

describe('formatUSD', () => {
  it('formats positive values with 2 decimal places', () => {
    expect(formatUSD(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(formatUSD(0)).toBe('$0.00');
  });

  it('formats negative values', () => {
    expect(formatUSD(-99.99)).toBe('-$99.99');
  });
});

const usdInSgLocaleSymbol = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})
  .format(0)
  .replace(/[\d,.\s]/g, '');

describe('formatCurrency', () => {
  it('defaults to SGD', () => {
    expect(formatCurrency(100)).toBe(`${sgdSymbol}100.00`);
  });

  it('formats SGD explicitly', () => {
    expect(formatCurrency(250.5, 'SGD')).toBe(`${sgdSymbol}250.50`);
  });

  it('formats USD using en-SG locale', () => {
    expect(formatCurrency(99.99, 'USD')).toBe(`${usdInSgLocaleSymbol}99.99`);
  });

  it('formats zero for both currencies', () => {
    expect(formatCurrency(0, 'SGD')).toBe(`${sgdSymbol}0.00`);
    expect(formatCurrency(0, 'USD')).toBe(`${usdInSgLocaleSymbol}0.00`);
  });
});
