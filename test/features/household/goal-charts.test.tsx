// @vitest-environment jsdom
import { GoalContributionsChart } from '@/features/household/components/goal-contributions-chart-content';
import { GoalItemsChart } from '@/features/household/components/goal-items-chart-content';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { goalWithItems, makeGoal } from './fixtures';

const visibility = vi.hoisted(() => ({ hidden: false }));
vi.mock('@/features/privacy', () => ({
  useAmountVisibility: () => ({
    hidden: visibility.hidden,
    canReveal: () => !visibility.hidden,
    mask: (value: string) => (visibility.hidden ? 'Hidden' : value),
  }),
}));

type Props = Record<string, unknown>;
const formatters = vi.hoisted(() => ({
  tick: [] as Array<(v: number) => string>,
  tooltip: [] as Array<(v: unknown, n: unknown) => unknown>,
  rows: [] as unknown[],
}));

vi.mock('@/lib/recharts', () => {
  const box = (testId: string) =>
    function Stub({ children }: { children?: React.ReactNode }) {
      return <div data-testid={testId}>{children}</div>;
    };
  return {
    CHART_AXIS_TICK_PROPS: {},
    CHART_TOOLTIP_PROPS: {},
    ResponsiveContainer: box('container'),
    LineChart: ({ data, children }: Props & { children?: React.ReactNode }) => {
      formatters.rows = data as unknown[];
      return <div data-testid="line-chart">{children}</div>;
    },
    BarChart: ({ data, children }: Props & { children?: React.ReactNode }) => {
      formatters.rows = data as unknown[];
      return <div data-testid="bar-chart">{children}</div>;
    },
    Line: box('line'),
    Bar: box('bar'),
    Cell: ({ fill }: { fill: string }) => (
      <i data-testid="cell" data-fill={fill} />
    ),
    ReferenceLine: box('reference-line'),
    XAxis: (props: Props) => {
      if (typeof props.tickFormatter === 'function')
        formatters.tick.push(props.tickFormatter as (v: number) => string);
      return <div data-testid="x-axis" />;
    },
    YAxis: (props: Props) => {
      if (typeof props.tickFormatter === 'function')
        formatters.tick.push(props.tickFormatter as (v: number) => string);
      return <div data-testid="y-axis" />;
    },
    Tooltip: (props: Props) => {
      if (typeof props.formatter === 'function')
        formatters.tooltip.push(
          props.formatter as (v: unknown, n: unknown) => unknown
        );
      return <div data-testid="tooltip" />;
    },
  };
});

// The date axis shares the collector and throws on numbers; only the amount axis matters.
function formatsAmount(fn: (v: number) => string, value: number, want: string) {
  try {
    return fn(value) === want;
  } catch {
    return false;
  }
}

beforeEach(() => {
  visibility.hidden = false;
  formatters.tick = [];
  formatters.tooltip = [];
  formatters.rows = [];
});
afterEach(cleanup);

it('renders only a placeholder for the contributions chart when hidden', () => {
  visibility.hidden = true;
  render(<GoalContributionsChart goal={goalWithItems} />);
  expect(screen.getByText('Contributions chart hidden')).toBeInTheDocument();
  expect(screen.queryByTestId('tooltip')).toBeNull();
  expect(screen.queryByTestId('x-axis')).toBeNull();
  expect(screen.queryByTestId('y-axis')).toBeNull();
});

it('renders only a placeholder for the budget chart when hidden', () => {
  visibility.hidden = true;
  render(<GoalItemsChart goal={goalWithItems} />);
  expect(screen.getByText('Budget chart hidden')).toBeInTheDocument();
  expect(screen.queryByTestId('tooltip')).toBeNull();
  expect(screen.queryByTestId('x-axis')).toBeNull();
  expect(screen.queryByTestId('y-axis')).toBeNull();
});

it('formats contribution axis and tooltip values as whole dollars', () => {
  render(<GoalContributionsChart goal={goalWithItems} />);
  expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  expect(formatters.tick.some((fn) => formatsAmount(fn, 1500, '$1,500'))).toBe(
    true
  );
  expect(formatters.rows).toEqual([
    { date: '2026-10-03', total: 600 },
    { date: '2026-10-09', total: 1000 },
  ]);
});

it('formats budget axis and tooltip values as whole dollars', () => {
  render(<GoalItemsChart goal={goalWithItems} />);
  expect(formatters.tick.some((fn) => formatsAmount(fn, 8000, '$8,000'))).toBe(
    true
  );
  expect(formatters.tooltip[0]?.(8000, 'Budget')).toEqual(['$8,000', 'Budget']);
});

it('colours only over-budget paid bars as a loss', () => {
  render(<GoalItemsChart goal={goalWithItems} />);
  const fills = screen.getAllByTestId('cell').map((c) => c.dataset.fill);
  expect(fills).toEqual(['var(--loss)', 'var(--chart-2)']);
});

it('caps the budget chart at eight items and notes the rest', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({
    id: `i${i}`,
    name: `Item ${i}`,
    budget: i + 1,
    paid: 0,
    remaining: i + 1,
    over: 0,
    payments: [],
  }));
  render(<GoalItemsChart goal={makeGoal({ items })} />);
  expect(formatters.rows).toHaveLength(8);
  expect(screen.getByText('+3 more below')).toBeInTheDocument();
});
