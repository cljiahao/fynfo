// @vitest-environment jsdom
import { SalaryFormDialog } from '@/features/salary/components/salary-form';
import { SalarySummary } from '@/features/salary/components/salary-summary';
import { SalarySummaryCards } from '@/features/salary/components/salary-summary-cards';
import { SalaryTable } from '@/features/salary/components/salary-table';
import { TaxReliefsDialog } from '@/features/salary/components/tax-reliefs-dialog';
import type { SalaryData } from '@/features/salary/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  getSalaryRecords: vi.fn(),
  getSalaryRecord: vi.fn(),
  upsertSalaryRecord: vi.fn(),
  deleteSalaryRecord: vi.fn(),
  getProfile: vi.fn(),
  getTaxReliefs: vi.fn(),
  upsertTaxReliefs: vi.fn(),
}));
vi.mock('@/features/salary/actions/salary-actions', () => actions);
vi.mock('@/features/salary/actions/relief-actions', () => actions);
vi.mock('@/features/profile/actions/profile-actions', () => actions);

function mount(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>),
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  actions.getSalaryRecords.mockResolvedValue([]);
  actions.getTaxReliefs.mockResolvedValue([]);
  actions.getProfile.mockResolvedValue({
    birthYear: 1990,
    isNsman: true,
    residencyStatus: 'resident',
  });
  actions.upsertSalaryRecord.mockResolvedValue(undefined);
  actions.deleteSalaryRecord.mockResolvedValue(undefined);
  actions.upsertTaxReliefs.mockResolvedValue(undefined);
});
afterEach(cleanup);

it.each(['Gross Salary', 'Bonus'])(
  'associates salary %s with its numeric input and label focus',
  async (name) => {
    mount(<SalaryFormDialog open onOpenChange={vi.fn()} />);
    const input = screen.getByRole('spinbutton', { name });
    await userEvent.click(screen.getByText(name, { selector: 'label' }));
    expect(input).toHaveFocus();
    expect(screen.getByLabelText('Month')).toBeEnabled();
  }
);

it('keeps salary dialog label targets distinct across mounted instances', () => {
  mount(
    <>
      <SalaryFormDialog open onOpenChange={vi.fn()} />
      <SalaryFormDialog open onOpenChange={vi.fn()} />
    </>
  );
  const dialogs = screen.getAllByRole('dialog', { hidden: true });
  const ids: string[] = [];
  for (const dialog of dialogs) {
    for (const name of ['Month', 'Gross Salary', 'Bonus']) {
      const label = within(dialog).getByText(name, { selector: 'label' });
      const target = label.getAttribute('for');
      expect(target).toBeTruthy();
      const input = dialog.querySelector(`[id="${target}"]`);
      expect(input).toBeTruthy();
      ids.push(target!);
    }
  }
  expect(ids).toHaveLength(6);
  expect(new Set(ids).size).toBe(6);
});

describe('salary recording through real forms and queries', () => {
  it('keeps tax calculations unavailable until a missing profile is completed', async () => {
    actions.getProfile.mockResolvedValue(null);
    mount(
      <>
        <SalarySummaryCards
          records={[{ id: '2026-01', salary: 5000, bonus: 0 }]}
        />
        <SalarySummary records={[]} />
      </>
    );
    expect(
      await screen.findByRole('link', { name: 'Complete profile' })
    ).toBeTruthy();
    expect(
      screen.getByText('Complete your profile for tax estimates')
    ).toBeTruthy();
    expect(screen.queryByText('Estimated Annual')).toBeNull();
    expect(screen.getByText('Current Salary')).toBeTruthy();
  });

  it('retries a failed profile read before revealing tax estimates', async () => {
    actions.getProfile
      .mockRejectedValueOnce(new Error('private profile error'))
      .mockResolvedValue({
        birthYear: 1990,
        residencyStatus: 'resident',
        isNsman: false,
      });
    mount(<SalarySummary records={[]} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Retry tax profile' })
    );
    expect(await screen.findByText('Estimated Annual')).toBeTruthy();
    expect(
      screen.getByText(/CPF assumes age 55 and below and full employee rates/)
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Resident personal reliefs, including CPF, are capped at SGD 80,000/
      )
    ).toBeTruthy();
    expect(screen.queryByText('private profile error')).toBeNull();
  });
  it('saves entered month and numeric salary, then closes only after the write finishes', async () => {
    let finish!: () => void;
    actions.upsertSalaryRecord.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        })
    );
    const close = vi.fn();
    mount(<SalaryFormDialog open onOpenChange={close} />);
    fireEvent.change(screen.getByLabelText('Month'), {
      target: { value: '2026-03' },
    });
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5000.25' } });
    fireEvent.change(inputs[1], { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(actions.upsertSalaryRecord).toHaveBeenCalledWith({
        id: '2026-03',
        salary: 5000.25,
        bonus: 300,
      })
    );
    expect(close).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    finish();
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  });

  it('loads an edit without allowing the month to change and retains the form after a failed write', async () => {
    actions.getSalaryRecord.mockResolvedValue({
      id: '2026-02',
      salary: 4000,
      bonus: 100,
    });
    actions.upsertSalaryRecord.mockRejectedValue(new Error('offline'));
    const close = vi.fn();
    mount(<SalaryFormDialog open editId="2026-02" onOpenChange={close} />);
    await waitFor(() =>
      expect(
        (screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value
      ).toBe('4000')
    );
    expect((screen.getByLabelText('Month') as HTMLInputElement).disabled).toBe(
      true
    );
    fireEvent.change(screen.getAllByRole('spinbutton')[1], {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() =>
      expect(actions.upsertSalaryRecord).toHaveBeenCalledWith({
        id: '2026-02',
        salary: 4000,
        bonus: 0,
      })
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(close).toHaveBeenCalledWith(false);
  });

  it('retries a failed record read before displaying editable amounts', async () => {
    actions.getSalaryRecord
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ id: '2026-01', salary: 2500, bonus: 0 });
    mount(<SalaryFormDialog open editId="2026-01" onOpenChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(
        (screen.getAllByRole('spinbutton')[0] as HTMLInputElement).value
      ).toBe('2500')
    );
  });

  it('paginates latest first, edits the selected row, and refreshes history after confirmed deletion', async () => {
    let records: SalaryData[] = Array.from({ length: 11 }, (_, i) => ({
      id: `2026-${String(i + 1).padStart(2, '0')}`,
      salary: 1000 + i,
      bonus: i === 10 ? 500 : 0,
    }));
    actions.getSalaryRecords.mockImplementation(async () => records);
    actions.deleteSalaryRecord.mockImplementation(async (id: string) => {
      records = records.filter((r) => r.id !== id);
    });
    const edit = vi.fn();
    mount(<SalaryTable onEdit={edit} />);
    const first = await screen.findByText('2026-11');
    const row = first.closest('tr')!;
    expect(within(row).getByText('$1,510.00')).toBeTruthy();
    fireEvent.click(
      within(row).getByRole('button', { name: 'Edit salary record' })
    );
    expect(edit).toHaveBeenCalledWith('2026-11');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('2026-01')).toBeTruthy();
    expect(screen.queryByText('2026-11')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(
      within(screen.getByText('2026-11').closest('tr')!).getByRole('button', {
        name: 'Delete salary record',
      })
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: /^Delete$/,
      })
    );
    await waitFor(() => expect(screen.queryByText('2026-11')).toBeNull());
    expect(actions.deleteSalaryRecord).toHaveBeenCalledWith('2026-11');
  });

  it('shows an empty history rather than invented salary records', async () => {
    mount(<SalaryTable />);
    expect(await screen.findByText('No salary records yet')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('salary calculations and relief controls', () => {
  it('changes child count and parent arrangement, omits disabled reliefs, and clears standard amounts', async () => {
    actions.getTaxReliefs.mockResolvedValue([
      { reliefKey: 'child', amount: 8000 },
      { reliefKey: 'parent', amount: 9000 },
      { reliefKey: 'spouse', amount: 2000 },
    ]);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: vi.fn(),
      configurable: true,
    });
    mount(
      <TaxReliefsDialog
        open
        onOpenChange={vi.fn()}
        earnedIncomeRelief={1000}
        nsmanRelief={1500}
        isNonResident={false}
      />
    );
    const child = (
      await screen.findByRole('checkbox', { name: 'Qualifying Child Relief' })
    ).closest('div.flex') as HTMLElement;
    fireEvent.keyDown(within(child).getByRole('combobox'), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('option', { name: /^3$/ }));
    expect(within(child).getByText('$12,000.00')).toBeTruthy();
    const parent = screen
      .getByRole('checkbox', { name: 'Parent Relief' })
      .closest('div.flex') as HTMLElement;
    fireEvent.keyDown(within(parent).getByRole('combobox'), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Not staying' }));
    expect(within(parent).getByText('$5,500.00')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Qualifying Child Relief' })
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Parent Relief' }));
    const spouse = screen
      .getByRole('checkbox', { name: 'Spouse Relief' })
      .closest('div.flex') as HTMLElement;
    fireEvent.change(within(spouse).getByRole('spinbutton'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() =>
      expect(actions.upsertTaxReliefs).toHaveBeenCalledWith(
        new Date().getFullYear(),
        [{ reliefKey: 'spouse', amount: 0 }]
      )
    );
  });

  it('shows zero-income summaries without annualizing absent records', async () => {
    mount(
      <>
        <SalarySummaryCards records={[]} />
        <SalarySummary records={[]} />
      </>
    );
    expect(
      await screen.findByText('No salary data for this year')
    ).toBeTruthy();
    expect(
      screen.getByText(`No records for ${new Date().getFullYear()}`)
    ).toBeTruthy();
    expect(
      screen.getByText('Based on 0 recorded month(s); provisional AW ceiling')
    ).toBeTruthy();
  });

  it('applies the loaded non-resident profile to summaries and hides resident relief actions', async () => {
    actions.getProfile.mockResolvedValue({
      birthYear: 1960,
      isNsman: false,
      residencyStatus: 'non_resident',
    });
    mount(
      <SalarySummary
        records={[
          { id: `${new Date().getFullYear()}-01`, salary: 5000, bonus: 0 },
        ]}
      />
    );
    await screen.findByText('Estimated Annual');
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: 'Reliefs' })).toHaveLength(
        0
      )
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Relief breakdown' })[0]
    );
    expect(screen.getByText('No personal reliefs')).toBeTruthy();
    expect(
      screen.getByText(
        'Non-resident employment: higher of 15% or resident rates'
      )
    ).toBeTruthy();
  });
  it('excludes older years from YTD and annualizes only the current records', async () => {
    const year = new Date().getFullYear();
    mount(
      <>
        <SalarySummaryCards
          records={[
            { id: `${year - 1}-12`, salary: 99999, bonus: 99999 },
            { id: `${year}-01`, salary: 5000, bonus: 1000 },
          ]}
        />
        <SalarySummary
          records={[{ id: `${year}-01`, salary: 5000, bonus: 1000 }]}
        />
      </>
    );
    expect(screen.getByText('$6,000')).toBeTruthy();
    expect(screen.getByText('$72,000')).toBeTruthy();
    await screen.findByText('Estimated Annual');
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Relief breakdown' })[0]
    );
    expect(await screen.findByText('Earned Income Relief')).toBeTruthy();
    expect(screen.getByText('NSMan Relief')).toBeTruthy();
  });

  it('persists enabled standard and child relief amounts through actual controls', async () => {
    const confirm = vi.fn();
    const close = vi.fn();
    mount(
      <TaxReliefsDialog
        open
        onOpenChange={close}
        earnedIncomeRelief={1000}
        nsmanRelief={0}
        isNonResident={false}
        onConfirm={confirm}
      />
    );
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Spouse Relief' })
    );
    const spouse = screen
      .getByRole('checkbox', { name: 'Spouse Relief' })
      .closest('div.flex')!;
    fireEvent.change(within(spouse as HTMLElement).getByRole('spinbutton'), {
      target: { value: '2500' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Qualifying Child Relief' })
    );
    expect(screen.getByText('$7,500.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(false));
    expect(actions.upsertTaxReliefs).toHaveBeenCalledWith(
      new Date().getFullYear(),
      [
        { reliefKey: 'spouse', amount: 2500 },
        { reliefKey: 'child', amount: 4000 },
      ]
    );
    expect(confirm).toHaveBeenLastCalledWith([
      { label: 'Spouse Relief', amount: 2500 },
      { label: 'Qualifying Child Relief', amount: 4000 },
    ]);
  });

  it('does not offer resident relief edits to a non-resident', async () => {
    mount(
      <TaxReliefsDialog
        open
        onOpenChange={vi.fn()}
        earnedIncomeRelief={0}
        nsmanRelief={0}
        isNonResident
      />
    );
    expect(
      await screen.findByText(
        /Non-resident employment uses the higher of 15% or resident rates/
      )
    ).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });
});

it('calculates recorded CPF per month rather than annualising the OW ceiling', async () => {
  const year = new Date().getFullYear();
  mount(
    <SalarySummary records={[{ id: `${year}-01`, salary: 20000, bonus: 0 }]} />
  );
  const title = await screen.findByText(`Recorded YTD (${year})`);
  const card = title.closest('[data-slot="card"]');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText('-$1,600.00')).toBeTruthy();
  expect(
    screen.getByText(/eligibility and PR-stage rates are not established/)
  ).toBeTruthy();
  expect(screen.queryByText(`True Annual (${year})`)).toBeNull();
});

it('preserves gross income when the CPF rules for a future year are unsupported', async () => {
  const year = vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2030);
  try {
    mount(
      <>
        <SalarySummary records={[{ id: '2030-01', salary: 5000, bonus: 0 }]} />
        <SalarySummaryCards
          records={[{ id: '2030-01', salary: 5000, bonus: 0 }]}
        />
      </>
    );
    expect(
      await screen.findByText('Tax and CPF estimates unavailable')
    ).toBeTruthy();
    expect(screen.getByText('CPF estimate unavailable')).toBeTruthy();
    expect(screen.getByText('$60,000')).toBeTruthy();
    expect(screen.queryByText('Infinity')).toBeNull();
  } finally {
    year.mockRestore();
  }
});

it('withholds projected tax as well as recorded estimates for duplicate salary months', async () => {
  const year = new Date().getFullYear();
  const records = [
    { id: `${year}-01`, salary: 5000, bonus: 0 },
    { id: `${year}-01`, salary: 5000, bonus: 0 },
  ];
  mount(
    <>
      <SalarySummary records={records} />
      <SalarySummaryCards records={records} />
    </>
  );
  expect(
    await screen.findByText('Tax and CPF estimates unavailable')
  ).toBeTruthy();
  expect(screen.getByText('CPF estimate unavailable')).toBeTruthy();
  expect(screen.queryByText('Projected annual gross')).toBeNull();
});

it('withholds overflowing income projections rather than formatting infinity', async () => {
  const year = new Date().getFullYear();
  mount(
    <SalarySummaryCards
      records={[
        { id: `${year}-01`, salary: Number.MAX_VALUE, bonus: Number.MAX_VALUE },
      ]}
    />
  );
  await screen.findByText('CPF estimate unavailable');
  expect(screen.queryByText(/∞|Infinity/)).toBeNull();
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});
