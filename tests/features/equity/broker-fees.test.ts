import { describe, expect, it } from 'vitest';

import { calculateFees } from '@/features/equity/lib/broker-fees';

// SGX fees: tradeValue * 0.000325 + tradeValue * 0.000075 + 0.35
// = tradeValue * 0.0004 + 0.35
function expectedSgxFees(tradeValue: number) {
  return tradeValue * 0.000325 + tradeValue * 0.000075 + 0.35;
}

describe('calculateFees — DBS Vickers, SG market', () => {
  it('buy: applies 0.12% commission, min SGD 10.90, plus SGX fees', () => {
    // 10000 * 0.0012 = 12 > 10.90 → commission = 12
    const result = calculateFees('DBS Vickers', 'DBS', 'buy', 10000, false);
    expect(result.commission).toBeCloseTo(12);
    expect(result.platformFee).toBe(0);
    expect(result.clearingFee).toBeCloseTo(expectedSgxFees(10000));
    expect(result.total).toBeCloseTo(12 + expectedSgxFees(10000));
  });

  it('buy: hits SGD 10.90 minimum commission for small trade', () => {
    // 5000 * 0.0012 = 6 < 10.90 → commission = 10.90
    const result = calculateFees('DBS Vickers', 'DBS', 'buy', 5000, false);
    expect(result.commission).toBeCloseTo(10.9);
    expect(result.total).toBeCloseTo(10.9 + expectedSgxFees(5000));
  });

  it('sell: applies 0.28% commission, min SGD 27.25, plus SGX fees', () => {
    // 10000 * 0.0028 = 28 > 27.25 → commission = 28
    const result = calculateFees('DBS Vickers', 'DBS', 'sell', 10000, false);
    expect(result.commission).toBeCloseTo(28);
    expect(result.clearingFee).toBeCloseTo(expectedSgxFees(10000));
    expect(result.total).toBeCloseTo(28 + expectedSgxFees(10000));
  });

  it('sell: hits SGD 27.25 minimum commission for small trade', () => {
    // 5000 * 0.0028 = 14 < 27.25 → commission = 27.25
    const result = calculateFees('DBS Vickers', 'DBS', 'sell', 5000, false);
    expect(result.commission).toBeCloseTo(27.25);
  });

  it('isCdp flag is ignored for DBS Vickers', () => {
    const withCdp = calculateFees('DBS Vickers', 'DBS', 'buy', 10000, true);
    const withoutCdp = calculateFees('DBS Vickers', 'DBS', 'buy', 10000, false);
    expect(withCdp).toEqual(withoutCdp);
  });
});

describe('calculateFees — DBS Vickers, US market', () => {
  it('buy: applies 0.15% commission, min USD 19.62, no clearing fee', () => {
    // 10000 * 0.0015 = 15 < 19.62 → minimum 19.62
    const result = calculateFees('DBS Vickers', 'AAPL', 'buy', 10000, false);
    expect(result.commission).toBeCloseTo(19.62);
    expect(result.clearingFee).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.total).toBeCloseTo(19.62);
  });

  it('buy: applies percentage when trade exceeds minimum threshold', () => {
    // 20000 * 0.0015 = 30 > 19.62 → commission = 30
    const result = calculateFees('DBS Vickers', 'MSFT', 'buy', 20000, false);
    expect(result.commission).toBeCloseTo(30);
    expect(result.total).toBeCloseTo(30);
  });

  it('sell: applies 0.18% commission, min USD 27.25', () => {
    // 10000 * 0.0018 = 18 < 27.25 → minimum 27.25
    const result = calculateFees('DBS Vickers', 'NVDA', 'sell', 10000, false);
    expect(result.commission).toBeCloseTo(27.25);
    expect(result.total).toBeCloseTo(27.25);
  });

  it('sell: applies percentage when trade exceeds minimum threshold', () => {
    // 20000 * 0.0018 = 36 > 27.25 → commission = 36
    const result = calculateFees('DBS Vickers', 'NVDA', 'sell', 20000, false);
    expect(result.commission).toBeCloseTo(36);
    expect(result.total).toBeCloseTo(36);
  });
});

describe('calculateFees — Moomoo, SG market, CDP', () => {
  it('CDP buy/sell: 0.10% commission + 0.12% platform fee, both min $4.99, plus SGX fees', () => {
    // 10000: commission = max(10, 4.99) = 10; platform = max(12, 4.99) = 12
    const result = calculateFees('Moomoo', 'DBS', 'buy', 10000, true);
    expect(result.commission).toBeCloseTo(10);
    expect(result.platformFee).toBeCloseTo(12);
    expect(result.clearingFee).toBeCloseTo(expectedSgxFees(10000));
    expect(result.total).toBeCloseTo(10 + 12 + expectedSgxFees(10000));
  });

  it('CDP: hits $4.99 minimums for small trade', () => {
    // 3000: commission = max(3, 4.99) = 4.99; platform = max(3.6, 4.99) = 4.99
    const result = calculateFees('Moomoo', 'DBS', 'buy', 3000, true);
    expect(result.commission).toBeCloseTo(4.99);
    expect(result.platformFee).toBeCloseTo(4.99);
    expect(result.total).toBeCloseTo(4.99 + 4.99 + expectedSgxFees(3000));
  });

  it('CDP sell uses the same fee structure as buy', () => {
    const buy = calculateFees('Moomoo', 'OCBC', 'buy', 10000, true);
    const sell = calculateFees('Moomoo', 'OCBC', 'sell', 10000, true);
    expect(buy).toEqual(sell);
  });
});

describe('calculateFees — Moomoo, SG market, Custodian', () => {
  it('Custodian: 0.03% commission + 0.03% platform fee, both min $0.99, plus SGX fees', () => {
    // 10000: commission = max(3, 0.99) = 3; platform = max(3, 0.99) = 3
    const result = calculateFees('Moomoo', 'DBS', 'buy', 10000, false);
    expect(result.commission).toBeCloseTo(3);
    expect(result.platformFee).toBeCloseTo(3);
    expect(result.clearingFee).toBeCloseTo(expectedSgxFees(10000));
    expect(result.total).toBeCloseTo(3 + 3 + expectedSgxFees(10000));
  });

  it('Custodian: hits $0.99 minimums for small trade', () => {
    // 2000: commission = max(0.6, 0.99) = 0.99; platform = 0.99
    const result = calculateFees('Moomoo', 'DBS', 'buy', 2000, false);
    expect(result.commission).toBeCloseTo(0.99);
    expect(result.platformFee).toBeCloseTo(0.99);
  });
});

describe('calculateFees — Moomoo, US market', () => {
  it('US: zero commission, flat $0.99 platform fee, no clearing fee', () => {
    const result = calculateFees('Moomoo', 'AAPL', 'buy', 5000, false);
    expect(result.commission).toBe(0);
    expect(result.platformFee).toBe(0.99);
    expect(result.clearingFee).toBe(0);
    expect(result.total).toBe(0.99);
  });

  it('US: fee is the same regardless of trade size', () => {
    const small = calculateFees('Moomoo', 'NVDA', 'buy', 100, false);
    const large = calculateFees('Moomoo', 'NVDA', 'buy', 100000, false);
    expect(small.total).toBe(0.99);
    expect(large.total).toBe(0.99);
  });
});

describe('calculateFees — Preferential Offering (isPO)', () => {
  it('PO SG: no commission or platform fee, only SGX clearing fees', () => {
    const result = calculateFees('DBS Vickers', 'DBS', 'buy', 10000, false, true);
    expect(result.commission).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.clearingFee).toBeCloseTo(expectedSgxFees(10000));
    expect(result.total).toBeCloseTo(expectedSgxFees(10000));
  });

  it('PO applies the same way for Moomoo', () => {
    const result = calculateFees('Moomoo', 'OCBC', 'buy', 10000, true, true);
    expect(result.commission).toBe(0);
    expect(result.platformFee).toBe(0);
    expect(result.total).toBeCloseTo(expectedSgxFees(10000));
  });

  it('isPO is ignored for US market (no SGX fees to apply)', () => {
    // isPO on US market: the condition only triggers for SG market
    const result = calculateFees('DBS Vickers', 'AAPL', 'buy', 10000, false, true);
    // Falls through to DBS US buy logic
    expect(result.commission).toBeCloseTo(19.62);
    expect(result.clearingFee).toBe(0);
  });
});

describe('calculateFees — ticker case-insensitivity', () => {
  it('lower-case ticker resolves to the correct market', () => {
    const upper = calculateFees('DBS Vickers', 'DBS', 'buy', 10000, false);
    const lower = calculateFees('DBS Vickers', 'dbs', 'buy', 10000, false);
    expect(lower).toEqual(upper);
  });
});
