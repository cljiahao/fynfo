// @vitest-environment jsdom
import { GoalBurnUpChart } from '@/features/household/components/goal-burn-up-chart-content';
import { ItemBreakdownBar } from '@/features/household/components/item-breakdown-bar';
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
const captured = vi.hoisted(() => ({
  tick: [] as Array<(v: number) => string>,
  tooltip: [] as Array<(v: unknown, n: unknown) => unknown>,
  rows: [] as Array<Record<string, unknown>>,
  lines: [] as string[],
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
      captured.rows = data as Array<Record<string, unknown>>;
      return <div data-testid="line-chart">{children}</div>;
    },
    Line: ({ dataKey }: Props) => {
      captured.lines.push(String(dataKey));
      return <div data-testid="line" />;
    },
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: (props: Props) => {
      if (typeof props.tickFormatter === 'function')
        captured.tick.push(props.tickFormatter as (v: number) => string);
      return <div data-testid="y-axis" />;
    },
    Tooltip: (props: Props) => {
      if (typeof props.formatter === 'function')
        captured.tooltip.push(
          props.formatter as (v: unknown, n: unknown) => unknown
        );
      return <div data-testid="tooltip" />;
    },
  };
});

beforeEach(() => {
  visibility.hidden = false;
  captured.tick = [];
  captured.tooltip = [];
  captured.rows = [];
  captured.lines = [];
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20));
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function item(index: number, budget: number, paid = 0) {
  return {
    id: `i${index}`,
    name: `Item ${index}`,
    budget,
    quote: null,
    paid,
    remaining: Math.max(0, budget - paid),
    over: Math.max(0, paid - budget),
    payments: [],
  };
}

it('renders only a placeholder for the burn-up chart when hidden', () => {
  visibility.hidden = true;
  render(<GoalBurnUpChart goal={goalWithItems} />);
  expect(screen.getByText('Burn-up chart hidden')).toBeInTheDocument();
  expect(screen.queryByTestId('tooltip')).toBeNull();
  expect(screen.queryByTestId('x-axis')).toBeNull();
  expect(screen.queryByTestId('y-axis')).toBeNull();
});

it('plots cumulative saved from creation and formats amounts as whole dollars', () => {
  render(<GoalBurnUpChart goal={goalWithItems} />);
  expect(captured.tick.some((fn) => fn(1500) === '$1,500')).toBe(true);
  expect(captured.tooltip[0]?.(1000, 'saved')).toEqual(['$1,000', 'Saved']);
  expect(captured.rows.map((r) => r.saved)).toEqual([0, 600, 1000, 1000]);
  expect(captured.lines).toEqual(['saved']);
});

it('adds the needed-pace line when the goal has a target date', () => {
  render(
    <GoalBurnUpChart goal={{ ...goalWithItems, targetDate: '2027-01-01' }} />
  );
  expect(captured.lines).toEqual(['needed', 'saved']);
  expect(captured.tooltip[0]?.(500, 'needed')).toEqual(['$500', 'Needed pace']);
  expect(captured.rows.at(-1)).toMatchObject({ needed: 10000, saved: null });
});

it('draws one segment per item with a tooltip and a paid part', () => {
  const { container } = render(<ItemBreakdownBar goal={goalWithItems} />);
  expect(container.querySelectorAll('g')).toHaveLength(2);
  expect(container.querySelectorAll('rect')).toHaveLength(4);
  expect(container.querySelector('title')).toHaveTextContent(/of \$8,000/);
});

it('collapses items beyond six into Other and lists them in the legend title', () => {
  const items = Array.from({ length: 9 }, (_, i) => item(i, 100 + i));
  render(
    <ItemBreakdownBar goal={makeGoal({ items, targetAmount: 5000 })} labels />
  );
  const other = screen.getByText('Other').closest('li');
  expect(other).toHaveAttribute('title', 'Item 2, Item 1, Item 0');
  expect(document.querySelectorAll('g')).toHaveLength(7);
});

it('shows the empty summary for a goal without items', () => {
  const { container } = render(
    <ItemBreakdownBar goal={makeGoal({ items: [] })} />
  );
  expect(container.querySelectorAll('g')).toHaveLength(0);
  expect(screen.getByText(/split into budget items/i)).toBeInTheDocument();
});

it('tints segments and rings the track when over-committed', () => {
  const goal = makeGoal({
    targetAmount: 1000,
    contributed: 500,
    items: [item(0, 800)],
  });
  const { container } = render(<ItemBreakdownBar goal={goal} />);
  expect(container.querySelector('.ring-destructive\\/60')).not.toBeNull();
  expect(container.querySelector('rect')).toHaveClass('fill-destructive/40');
});

it('draws no segments and no legend amounts when amounts are hidden', () => {
  visibility.hidden = true;
  const { container } = render(
    <ItemBreakdownBar goal={goalWithItems} labels />
  );
  expect(container.querySelector('svg')).toBeNull();
  expect(container.textContent).not.toMatch(/\d/);
});

it('omits the legend without labels', () => {
  render(<ItemBreakdownBar goal={goalWithItems} />);
  expect(screen.queryByRole('list')).toBeNull();
});
