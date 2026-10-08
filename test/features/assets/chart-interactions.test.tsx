// @vitest-environment jsdom
import { AssetLineChart } from '@/features/assets/components/asset-bar-chart';
import { CategoryBreakdown } from '@/features/assets/components/category-breakdown';
import { SalaryChart } from '@/features/salary/components/salary-chart';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) =>
    clearTimeout(id)
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const height =
        this.classList.contains('recharts-responsive-container') ||
        this.classList.contains('recharts-wrapper')
          ? 400
          : 20;
      const width =
        this.id === 'recharts_measurement_span'
          ? (this.textContent?.length ?? 0) * 7
          : 800;
      return {
        x: 0,
        y: 0,
        width,
        height,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        toJSON: () => ({}),
      };
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: { width: 800, height: 400 },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('filters real asset chart series and restores their legend entry', async () => {
  const { container } = render(
    <AssetLineChart
      data={[
        {
          month: 'Jan 2026',
          id: '2026-01',
          savings: 100,
          bonds: 200,
          stocks: 300,
          etf: 400,
          non_equity: 0,
          crypto: 0,
          pension: 500,
          total: 1500,
          total_investment: 700,
          excl_pension: 1000,
        },
      ]}
    />
  );
  await waitFor(
    () => expect(container.querySelectorAll('.recharts-line')).toHaveLength(10),
    { timeout: 5000 }
  );
  fireEvent.pointerDown(
    screen.getByRole('button', { name: 'Filter (10/10)' }),
    { button: 0, ctrlKey: false }
  );
  fireEvent.click(
    await screen.findByRole('menuitemcheckbox', { name: 'Total Assets' })
  );
  expect(screen.getByText('Filter (9/10)')).toBeTruthy();
  await waitFor(() =>
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(9)
  );
  fireEvent.click(
    screen.getByRole('menuitemcheckbox', { name: 'Total Assets' })
  );
  await waitFor(
    () => expect(container.querySelectorAll('.recharts-line')).toHaveLength(10),
    { timeout: 5000 }
  );
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Savings' }));
  await waitFor(() =>
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(9)
  );
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
  fireEvent.focus(screen.getByRole('application'));
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
  await waitFor(() =>
    expect(
      container.querySelector('.recharts-tooltip-wrapper')?.textContent
    ).toContain('$1,500')
  );
});

it('renders cumulative earnings as a third salary series and formats month and axis labels', async () => {
  const { container, rerender } = render(
    <SalaryChart
      records={[
        { id: '2026-01', salary: 1000, bonus: 500 },
        { id: '2026-02', salary: 2000, bonus: 0 },
      ]}
    />
  );
  await waitFor(
    () => expect(container.querySelectorAll('.recharts-line')).toHaveLength(3),
    { timeout: 5000 }
  );
  expect(screen.getByText('Cumulative Total')).toBeTruthy();
  expect(screen.getByText('Jan 2026')).toBeTruthy();
  expect(screen.getByText('Feb 2026')).toBeTruthy();
  expect(container.textContent).toContain('$');
  fireEvent.focus(screen.getByRole('application'));
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' });
  await waitFor(() =>
    expect(
      container.querySelector('.recharts-tooltip-wrapper')?.textContent
    ).toContain('$3,500')
  );
  rerender(<SalaryChart records={[]} />);
  expect(screen.getByText('No salary records yet')).toBeTruthy();
  expect(container.querySelectorAll('.recharts-line')).toHaveLength(0);
});

it('draws only recognized positive CPF accounts and formats the chart amounts', async () => {
  const { container } = render(
    <CategoryBreakdown
      snapshot={{
        id: '2026-01',
        entries: [
          { category: 'pension', account: 'oa', amount: 1000 },
          { category: 'pension', account: 'SA', amount: 2000 },
          { category: 'pension', account: 'MA', amount: 0 },
          { category: 'pension', account: 'Other', amount: 3000 },
        ],
      }}
    />
  );
  expect(screen.getByText('CPF Breakdown')).toBeTruthy();
  await waitFor(() =>
    expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(
      2
    )
  );
  expect(screen.getAllByText('OA')[0]).toBeTruthy();
  expect(screen.getAllByText('SA')[0]).toBeTruthy();
  expect(screen.queryByText('MA')).toBeNull();
  expect(await screen.findByText('$1,000', {}, { timeout: 3000 })).toBeTruthy();
  expect(await screen.findByText('$2,000', {}, { timeout: 3000 })).toBeTruthy();
});

it('does not render chart controls before any asset snapshot exists', () => {
  render(<AssetLineChart data={[]} />);
  expect(screen.getByText('No data yet')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull();
});
