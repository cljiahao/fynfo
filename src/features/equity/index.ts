export { getDividends } from './actions/dividend-actions';
export { getTrades } from './actions/equity-actions';
export * from './components';
export * from './hooks';
export type { DividendData, EquityTradeData } from './types';

export { runDividendAutoScan, shouldAutoScan } from './lib/auto-scan';
export { averageMonthlyTTM, expenseCoverage } from './lib/dividend-breakdown';
export { dividendSummary } from './lib/dividend-metrics';
export { computeHoldings, holdingMarkets } from './lib/holdings';
export type { Holding } from './lib/holdings';
export { getMarket, resolveMarket } from './lib/ticker-map';
export {
  finiteProduct,
  holdingPrice,
  marketValue,
  validExchangeRate,
} from './lib/valuation';
export type { ValuationQuote } from './lib/valuation';
