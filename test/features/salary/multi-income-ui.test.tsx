// @vitest-environment jsdom
import { buildSalaryChartData } from '@/features/salary/components/salary-chart-content';
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import {
  SalaryTable,
  salaryChangedMonths,
} from '@/features/salary/components/salary-table';
import { useSalaryYtdStats } from '@/features/salary/hooks/use-salary-ytd-stats';
import { toSalaryData } from '@/features/salary/lib/income-aggregates';
import type { IncomeLine, SalaryData } from '@/features/salary/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getSalaryRecords: vi.fn(),
  getSalaryRecord: vi.fn(),
  upsertSalaryRecord: vi.fn(),
  deleteSalaryRecord: vi.fn(),
}));
vi.mock('@/features/salary/actions/salary-actions', () => actions);
vi.mock('@/features/profile', () => ({
  useProfile: () => ({
    data: { birthYear: 1990, isNsman: false, residencyStatus: 'resident' },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/features/salary/hooks/use-tax-reliefs', () => ({
  useTaxReliefs: () => ({
    data: [],
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

function line(
  id: string,
  type: IncomeLine['type'],
  label: string,
  amount: number
): IncomeLine {
  return { id, type, label, amount };
}
function month(id: string, lines: IncomeLine[]): SalaryData {
  return toSalaryData(id, lines);
}

function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  actions.getSalaryRecords.mockResolvedValue([]);
  actions.upsertSalaryRecord.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('salary form lines', () => {
  const history = [
    month('2026-01', [line('a', 'salary', 'Acme', 4000)]),
    month('2026-02', [
      line('b', 'salary', 'Acme', 4200),
      line('c', 'salary', 'Side Co', 800),
      line('d', 'bonus', 'Bonus', 1000),
    ]),
  ];

  it('prefills a new month from every salary line of the latest month', async () => {
    actions.getSalaryRecords.mockResolvedValue(history);
    mount(<SalaryFormDialog open onOpenChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByLabelText('Line 2 amount')).toHaveValue(800)
    );
    expect(screen.getByLabelText('Line 1 label')).toHaveValue('Acme');
    expect(screen.getByLabelText('Line 1 amount')).toHaveValue(4200);
    expect(screen.getByLabelText('Line 2 label')).toHaveValue('Side Co');
    expect(screen.queryByLabelText('Line 3 amount')).toBeNull();
  });

  it('adds and removes lines, and saves only lines that have an amount', async () => {
    actions.getSalaryRecords.mockResolvedValue(history);
    mount(<SalaryFormDialog open onOpenChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByLabelText('Line 2 amount')).toHaveValue(800)
    );
    fireEvent.change(screen.getByLabelText('Line 1 amount'), {
      target: { value: '4500' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 2' }));
    expect(screen.queryByLabelText('Line 2 amount')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    expect(screen.getByLabelText('Line 3 label')).toHaveValue('Bonus');
    fireEvent.change(screen.getByLabelText('Line 2 amount'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(actions.upsertSalaryRecord).toHaveBeenCalledOnce()
    );
    const saved = actions.upsertSalaryRecord.mock.calls[0][0] as {
      lines: IncomeLine[];
    };
    expect(
      saved.lines.map(({ type, label, amount }) => ({ type, label, amount }))
    ).toEqual([
      { type: 'salary', label: 'Acme', amount: 4500 },
      { type: 'bonus', label: 'Bonus', amount: 2000 },
    ]);
  });

  it('does not overwrite lines the user has already edited when records arrive', async () => {
    let resolve!: (rows: SalaryData[]) => void;
    actions.getSalaryRecords.mockReturnValue(
      new Promise<SalaryData[]>((r) => {
        resolve = r;
      })
    );
    mount(<SalaryFormDialog open onOpenChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Line 1 amount'), {
      target: { value: '123' },
    });
    resolve(history);
    await waitFor(() => expect(actions.getSalaryRecords).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.getByLabelText('Line 1 amount')).toHaveValue(123);
  });
});

describe('salary table', () => {
  it('marks months where a salary amount or employer changes', () => {
    const records = [
      month('2026-01', [line('1', 'salary', 'Acme', 4000)]),
      month('2026-02', [line('2', 'salary', ' acme ', 4000)]),
      month('2026-03', [line('3', 'salary', 'Acme', 4400)]),
      month('2026-04', [
        line('4', 'salary', 'Acme', 4400),
        line('5', 'bonus', 'Bonus', 900),
      ]),
      month('2026-05', [line('6', 'salary', 'Globex', 4400)]),
      month('2026-06', [line('7', 'one_time', 'Freelance', 300)]),
    ];
    expect([...salaryChangedMonths(records)]).toEqual(['2026-03', '2026-05']);
  });

  it('shows recurring, bonus, one-time and total columns and expands lines', async () => {
    actions.getSalaryRecords.mockResolvedValue([
      month('2026-01', [line('1', 'salary', 'Acme', 4000)]),
      month('2026-02', [
        line('2', 'salary', 'Acme', 4200),
        line('3', 'bonus', 'Bonus', 500),
        line('4', 'one_time', 'AWS', 300),
      ]),
    ]);
    mount(<SalaryTable />);
    const row = (await screen.findByText('2026-02')).closest('tr')!;
    const cells = within(row).getAllByRole('cell');
    expect(cells.slice(1, 5).map((c) => c.textContent)).toEqual([
      '$4,200.00',
      '$500.00',
      '$300.00',
      '$5,000.00',
    ]);
    expect(within(row).getByText('Salary changed')).toBeInTheDocument();
    expect(screen.queryByText('AWS')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Show income lines for 2026-02' })
    );
    expect(screen.getByText('AWS')).toBeInTheDocument();
    expect(screen.getAllByText('One-time')).toHaveLength(2);
  });
});

describe('salary chart data', () => {
  it('splits each month into recurring, bonus and one-time with a running total', () => {
    const data = buildSalaryChartData([
      month('2026-01', [
        line('1', 'salary', 'Acme', 1000),
        line('2', 'bonus', 'Bonus', 200),
      ]),
      month('2026-02', [
        line('3', 'salary', 'Acme', 1000),
        line('4', 'one_time', 'AWS', 50),
      ]),
    ]);
    expect(data).toEqual([
      {
        month: 'Jan 2026',
        recurring: 1000,
        bonus: 200,
        oneTime: 0,
        cumulative: 1200,
      },
      {
        month: 'Feb 2026',
        recurring: 1000,
        bonus: 0,
        oneTime: 50,
        cumulative: 2250,
      },
    ]);
  });
});

describe('useSalaryYtdStats', () => {
  const year = new Date().getFullYear();
  const id = (m: number) => `${year}-${String(m).padStart(2, '0')}`;

  function stats(records: SalaryData[]) {
    return renderHook(() => useSalaryYtdStats(records), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          {children}
        </QueryClientProvider>
      ),
    }).result.current;
  }

  it('keeps recurring, bonus and one-time separate', () => {
    const result = stats([
      month(id(1), [
        line('1', 'salary', 'Acme', 5000),
        line('2', 'bonus', 'Bonus', 1000),
      ]),
      month(id(2), [
        line('3', 'salary', 'Acme', 5000),
        line('4', 'one_time', 'AWS', 700),
      ]),
    ]);
    expect(result.ytdSalary).toBe(10000);
    expect(result.ytdBonus).toBe(1000);
    expect(result.ytdOneTime).toBe(700);
  });

  it('does not count a one-time-only month as a recorded salary month', () => {
    const result = stats([
      month(id(1), [line('1', 'salary', 'Acme', 5000)]),
      month(id(2), [line('2', 'one_time', 'AWS', 700)]),
    ]);
    expect(result.monthsRecorded).toBe(1);
    expect(result.estAnnualSalary).toBe(60000);
  });

  it('bases the annual estimate on recurring pay only', () => {
    const withOneTime = stats([
      month(id(1), [
        line('1', 'salary', 'Acme', 5000),
        line('2', 'one_time', 'AWS', 9000),
      ]),
    ]);
    expect(withOneTime.estAnnualSalary).toBe(60000);
    expect(withOneTime.estAnnualBonus).toBe(0);
  });

  it('applies the ordinary wage ceiling per employer', () => {
    const single = stats([month(id(1), [line('1', 'salary', 'Acme', 12000)])]);
    const split = stats([
      month(id(1), [
        line('1', 'salary', 'Acme', 6000),
        line('2', 'salary', 'Globex', 6000),
      ]),
    ]);
    expect(single.trueSummary?.totalCpf).toBeGreaterThan(0);
    expect(split.trueSummary?.totalCpf).toBeGreaterThan(
      single.trueSummary?.totalCpf ?? 0
    );
  });

  it('taxes one-time income without adding CPF for it', () => {
    const base = stats([month(id(1), [line('1', 'salary', 'Acme', 5000)])]);
    const withOneTime = stats([
      month(id(1), [
        line('1', 'salary', 'Acme', 5000),
        line('2', 'one_time', 'AWS', 1000),
      ]),
    ]);
    expect(withOneTime.trueSummary?.totalCpf).toBe(base.trueSummary?.totalCpf);
    expect(withOneTime.trueSummary?.grossAnnual).toBe(
      (base.trueSummary?.grossAnnual ?? 0) + 1000
    );
  });
});
