import { getMarket } from './ticker-map';

// All rates are GST-inclusive where stated

interface FeeResult {
  commission: number;
  platformFee: number;
  clearingFee: number;
  total: number;
}

// SGX regulatory fees (apply to all SG brokers)
const SGX_CLEARING_FEE_PCT = 0.000325; // 0.0325%
const SGX_TRADING_FEE_PCT = 0.000075; // 0.0075%
const SGX_SETTLEMENT_FEE = 0.35; // SGD per transaction

function sgxFees(tradeValue: number): number {
  return (
    tradeValue * SGX_CLEARING_FEE_PCT +
    tradeValue * SGX_TRADING_FEE_PCT +
    SGX_SETTLEMENT_FEE
  );
}

// --- DBS Vickers ---

function dbsSgBuy(tradeValue: number): FeeResult {
  // Cash Upfront: 0.12%, min SGD 10.90
  const commission = Math.max(tradeValue * 0.0012, 10.9);
  const clearing = sgxFees(tradeValue);
  return { commission, platformFee: 0, clearingFee: clearing, total: commission + clearing };
}

function dbsSgSell(tradeValue: number): FeeResult {
  // Standard: 0.28%, min SGD 27.25
  const commission = Math.max(tradeValue * 0.0028, 27.25);
  const clearing = sgxFees(tradeValue);
  return { commission, platformFee: 0, clearingFee: clearing, total: commission + clearing };
}

function dbsUsBuy(tradeValue: number): FeeResult {
  // Cash Upfront: 0.15%, min USD 19.62
  const commission = Math.max(tradeValue * 0.0015, 19.62);
  return { commission, platformFee: 0, clearingFee: 0, total: commission };
}

function dbsUsSell(tradeValue: number): FeeResult {
  // Standard: 0.18%, min USD 27.25
  const commission = Math.max(tradeValue * 0.0018, 27.25);
  return { commission, platformFee: 0, clearingFee: 0, total: commission };
}

// --- Moomoo ---

function moomooSgCdpBuySell(tradeValue: number): FeeResult {
  // CDP: Commission 0.10% (min $4.99) + Platform 0.12% (min $4.99)
  const commission = Math.max(tradeValue * 0.001, 4.99);
  const platformFee = Math.max(tradeValue * 0.0012, 4.99);
  const clearing = sgxFees(tradeValue);
  return { commission, platformFee, clearingFee: clearing, total: commission + platformFee + clearing };
}

function moomooSgCustodianBuySell(tradeValue: number): FeeResult {
  // Custodian: Commission 0.03% (min $0.99) + Platform 0.03% (min $0.99)
  const commission = Math.max(tradeValue * 0.0003, 0.99);
  const platformFee = Math.max(tradeValue * 0.0003, 0.99);
  const clearing = sgxFees(tradeValue);
  return { commission, platformFee, clearingFee: clearing, total: commission + platformFee + clearing };
}

function moomooUsBuySell(tradeValue: number): FeeResult {
  // US: $0 commission, USD 0.99 platform fee per order
  return { commission: 0, platformFee: 0.99, clearingFee: 0, total: 0.99 };
}

// --- Public API ---

export const BROKERS = ['DBS Vickers', 'Moomoo'] as const;
export type Broker = (typeof BROKERS)[number];

export function calculateFees(
  broker: Broker,
  ticker: string,
  action: 'buy' | 'sell',
  tradeValue: number,
  isCdp: boolean,
  isPO: boolean = false
): FeeResult {
  const market = getMarket(ticker.toUpperCase());

  // Preferential Offering: no broker commission, only SGX clearing fees
  if (isPO && market === 'SG') {
    const clearing = sgxFees(tradeValue);
    return { commission: 0, platformFee: 0, clearingFee: clearing, total: clearing };
  }

  if (broker === 'DBS Vickers') {
    if (market === 'SG') {
      return action === 'buy' ? dbsSgBuy(tradeValue) : dbsSgSell(tradeValue);
    }
    return action === 'buy' ? dbsUsBuy(tradeValue) : dbsUsSell(tradeValue);
  }

  // Moomoo
  if (market === 'SG') {
    return isCdp
      ? moomooSgCdpBuySell(tradeValue)
      : moomooSgCustodianBuySell(tradeValue);
  }
  return moomooUsBuySell(tradeValue);
}
