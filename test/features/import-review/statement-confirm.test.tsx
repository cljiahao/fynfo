// @vitest-environment jsdom
import type { ImportedExpenseInput } from '@/features/expenses/lib/import-expense';
import { ImportActionBar } from '@/features/import-review/components/import-action-bar';
import { StatementReconciliationNotice } from '@/features/import-review/components/statement-reconciliation-notice';
import { useStatementSave } from '@/features/import-review/hooks/use-statement-save';
import {
  parseStatementLines,
  positionedStatementLines,
} from '@/features/import-review/lib/statement-parser';
import type { PositionedStatementText } from '@/features/import-review/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock('@/features/expenses', async () => ({
  ...(await import('@/features/expenses/lib/import-expense')),
  ...(await import('@/features/expenses/constants')),
  getExpenses: api.read,
  getExpensesInRange: api.read,
  insertImportedExpenses: api.save,
}));

const period = { from: '2026-10-01', to: '2026-10-31' };

function rowItems(
  y: number,
  name: string,
  amount: string,
  confidence?: number
): PositionedStatementText[] {
  const extra = confidence === undefined ? {} : { confidence };
  return [
    { text: '01 OCT', x: 40, y, ...extra },
    { text: name, x: 120, y, ...extra },
    { text: amount, x: 500, y, ...extra },
  ];
}

function review(scan: boolean) {
  const items = [
    { text: 'UOB SGD billed', x: 40, y: 700 },
    ...rowItems(600, 'CLEAR SHOP', '10.00', scan ? 95 : undefined),
    ...rowItems(580, 'BLURRY SHOP', '20.00', scan ? 79 : undefined),
  ];
  const rows = parseStatementLines(
    positionedStatementLines(items, 1),
    'uob',
    period
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const hook = renderHook(() => useStatementSave(rows, 'uob', period), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { rows, ...hook };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.read.mockResolvedValue([]);
  api.save.mockImplementation(async (inputs: ImportedExpenseInput[]) =>
    inputs.map(({ id }) => ({ id, status: 'confirmed' }))
  );
});
afterEach(cleanup);

describe('flagged OCR rows', () => {
  it('are skipped by select all and need a per-row confirm before ticking', () => {
    const { rows, result } = review(true);
    const [clear, blurry] = rows;
    act(() => result.current.selectExpenses(rows));
    expect(result.current.selection).toEqual([clear.id]);

    act(() => result.current.toggle(blurry));
    expect(result.current.selection).toEqual([clear.id]);
    expect(result.current.needsConfirmation(blurry)).toBe(true);

    act(() => result.current.confirmRow(blurry));
    expect(result.current.isConfirmed(blurry.id)).toBe(true);
    act(() => result.current.toggle(blurry));
    expect(result.current.selection).toEqual([clear.id, blurry.id]);
  });

  it('import once confirmed and ticked', async () => {
    const { rows, result } = review(true);
    act(() => result.current.confirmRow(rows[1]));
    act(() => result.current.toggle(rows[1]));
    await act(() => result.current.compare());
    await act(() => result.current.save());
    expect(api.save).toHaveBeenCalledTimes(1);
    const sent = api.save.mock.calls[0][0] as ImportedExpenseInput[];
    expect(sent.map(({ description }) => description)).toEqual(['BLURRY SHOP']);
  });

  it('never confirms an unflagged row', () => {
    const { rows, result } = review(true);
    act(() => result.current.confirmRow(rows[0]));
    expect(result.current.isConfirmed(rows[0].id)).toBe(false);
    expect(result.current.needsConfirmation(rows[0])).toBe(false);
  });
});

describe('text-layer imports', () => {
  it('have no flags and select every row', () => {
    const { rows, result } = review(false);
    expect(rows.every((row) => row.confidence === undefined)).toBe(true);
    act(() => result.current.selectExpenses(rows));
    expect(result.current.selection).toHaveLength(2);
    expect(rows.some((row) => result.current.needsConfirmation(row))).toBe(
      false
    );
  });
});

function withPrivacy(node: ReactNode) {
  return <AmountVisibilityProvider>{node}</AmountVisibilityProvider>;
}

describe('reconciliation notice', () => {
  it('says the total was not checked when the layout has none', () => {
    render(
      withPrivacy(
        <StatementReconciliationNotice
          reconciliation={{ status: 'unchecked' }}
        />
      )
    );
    expect(screen.getByRole('status').textContent).toMatch(
      /total not checked/i
    );
  });

  it('shows the difference on a mismatch', () => {
    render(
      withPrivacy(
        <StatementReconciliationNotice
          reconciliation={{
            status: 'mismatch',
            mismatches: [
              { totalCents: 3000, parsedCents: 2950, differenceCents: -50 },
            ],
          }}
        />
      )
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/do not add up/i);
    expect(alert.textContent).toContain('difference -SGD 0.50');
  });

  it.each([{ status: 'matched' as const }, { status: 'not_ocr' as const }])(
    'renders nothing for $status',
    (reconciliation) => {
      const { container } = render(
        withPrivacy(
          <StatementReconciliationNotice reconciliation={reconciliation} />
        )
      );
      expect(container.textContent).toBe('');
    }
  );
});

describe('action bar with a blocked select all', () => {
  function bar(blocked: boolean) {
    const { result } = review(true);
    render(
      withPrivacy(
        <ImportActionBar
          save={result.current}
          eligibleCount={1}
          onSelectAll={() => {}}
          onNextDuplicate={() => {}}
          selectAllBlocked={blocked}
        />
      )
    );
  }

  it('disables select all', () => {
    bar(true);
    expect(
      (screen.getByRole('button', { name: /select all/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('keeps select all on when not blocked', () => {
    bar(false);
    expect(
      (screen.getByRole('button', { name: /select all/i }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  });
});
