// @vitest-environment jsdom
import { DividendIncomeChart } from '@/features/equity/components/dividend-income-chart';
import type { DividendData } from '@/features/equity/types';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({
  data: [] as Array<{ year: string; total: number }>,
}));
vi.mock('@/lib/recharts', () => ({
  BarChart: ({
    data,
  }: {
    data: Array<{ year: string; total: number }>;
    children?: ReactNode;
  }) => {
    captured.data = data;
    return null;
  },
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  Bar: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CHART_AXIS_TICK_PROPS: {},
  CHART_TOOLTIP_PROPS: {},
}));

const thisYear = new Date().getFullYear();
const rows: DividendData[] = [
  {
    id: 'a',
    date: `${thisYear - 3}-03-01`,
    ticker: 'DBS',
    amount: 10,
    currency: 'SGD',
  },
  {
    id: 'b',
    date: `${thisYear - 1}-03-01`,
    ticker: 'DBS',
    amount: 20,
    currency: 'SGD',
  },
];

beforeEach(() => {
  captured.data = [];
});
afterEach(cleanup);

it('keeps only years with data when no window is requested', () => {
  render(<DividendIncomeChart dividends={rows} usdSgdRate={1} />);
  expect(captured.data).toEqual([
    { year: String(thisYear - 3), total: 10 },
    { year: String(thisYear - 1), total: 20 },
  ]);
});

it('zero-fills an ascending window of the requested years', () => {
  render(<DividendIncomeChart dividends={rows} usdSgdRate={1} years={5} />);
  expect(captured.data).toEqual([
    { year: String(thisYear - 4), total: 0 },
    { year: String(thisYear - 3), total: 10 },
    { year: String(thisYear - 2), total: 0 },
    { year: String(thisYear - 1), total: 20 },
    { year: String(thisYear), total: 0 },
  ]);
});
