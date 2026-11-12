'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAmountVisibility } from '@/features/privacy';
import { formatSGDWhole } from '@/lib/utils/currency';
import { useMemo, useState } from 'react';
import {
  buildFreedomInput,
  buildLeverContext,
  cpfFromSnapshot,
  useDividendAvgMonthly,
  useFreedomAssumptions,
} from '../hooks/use-freedom-inputs';
import {
  DEFAULT_RETURN_SPREAD_PCT,
  computeFreedomLevers,
  projectFreedom,
  visibleFreedomLevers,
  type FreedomProjection,
} from '../lib/freedom-projection';
import type { SnapshotData } from '../types';
import { FreedomAssumptionsForm } from './freedom-assumptions-form';
import {
  CAP_YEARS,
  formatLever,
  formatMonthLabel,
  freedomSummary,
  monthsByYear,
  plural,
} from './freedom-format';
import type { PlannerValues } from './salary-planner';

const MAX_TABLE_ROWS = 60;

interface FreedomCardProps {
  planner: PlannerValues;
  snapshot: SnapshotData | undefined;
}

function RunLine({
  label,
  run,
}: {
  label: string;
  run: FreedomProjection['base'];
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {run.date === null
          ? `Not within ${CAP_YEARS} years`
          : formatMonthLabel(run.date)}
      </dd>
    </div>
  );
}

export function FreedomCard({ planner, snapshot }: FreedomCardProps) {
  const { mask } = useAmountVisibility();
  const [now] = useState(() => new Date());
  const [expanded, setExpanded] = useState(false);
  const [showAllLevers, setShowAllLevers] = useState(false);
  const dividendAvgMonthly = useDividendAvgMonthly();
  const { assumptions, save, isSaving, persisted } = useFreedomAssumptions();

  const input = useMemo(
    () =>
      buildFreedomInput({
        planner,
        snapshot,
        assumptions,
        dividendAvgMonthly,
        now,
      }),
    [planner, snapshot, assumptions, dividendAvgMonthly, now]
  );
  const projection = useMemo(() => projectFreedom(input), [input]);
  const levers = useMemo(
    () =>
      computeFreedomLevers(input, buildLeverContext(planner, snapshot), {
        maskName: mask,
      }),
    [input, planner, snapshot, mask]
  );

  const unset = projection.status === 'no_assumptions';
  const usable =
    projection.status === 'ok' || projection.status === 'no_portfolio';
  const money = (value: number) => mask(formatSGDWhole(value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial freedom</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm">{freedomSummary(projection)}</p>
          {assumptions.realReturnPct !== null &&
            assumptions.withdrawalRatePct !== null && (
              <p className="text-muted-foreground text-xs">
                Assumes {assumptions.realReturnPct}% real return (+/-{' '}
                {DEFAULT_RETURN_SPREAD_PCT}), {assumptions.withdrawalRatePct}%
                withdrawal rate.
              </p>
            )}
          {!persisted && (
            <p className="text-muted-foreground text-xs">
              Not saved yet. These assumptions are used for this session only.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Projection from your own assumptions, not a forecast or advice.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={expanded}
          aria-controls="freedom-detail"
          onClick={() => setExpanded((open) => !open)}
        >
          {unset ? 'Add assumptions' : expanded ? 'Hide detail' : 'Show detail'}
        </Button>

        {expanded && (
          <div id="freedom-detail" className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Assumptions</h3>
              <FreedomAssumptionsForm
                assumptions={assumptions}
                currentYear={now.getFullYear()}
                onSave={save}
                isSaving={isSaving}
              />
              <p className="text-muted-foreground text-xs">
                Living cost is your planner expenses, expense buffer and
                household budgets. Insurance, tithe and allowance are not
                included. All figures are in today&apos;s money.
              </p>
            </section>

            {usable && (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-medium">Dates</h3>
                  <dl className="space-y-1">
                    <RunLine label="Low case" run={projection.low} />
                    <RunLine label="Base case" run={projection.base} />
                    <RunLine label="High case" run={projection.high} />
                  </dl>
                  {projection.freedomNumber !== null && (
                    <p className="text-sm">
                      Freedom number: {money(projection.freedomNumber)}
                    </p>
                  )}
                  <p className="text-sm">
                    Invested portfolio: {money(input.portfolio)}
                  </p>
                  {cpfFromSnapshot(snapshot) > 0 && (
                    <p className="text-muted-foreground text-xs">
                      CPF (locked): {money(cpfFromSnapshot(snapshot))} (not
                      counted)
                    </p>
                  )}
                  {projection.onTrackForTarget !== null &&
                    assumptions.targetYear !== null && (
                      <p className="text-sm">
                        {projection.onTrackForTarget
                          ? `On track for your target year of ${assumptions.targetYear}.`
                          : `Not on track for your target year of ${assumptions.targetYear} at this pace.`}
                      </p>
                    )}
                </section>

                <YearlyTable projection={projection} now={now} money={money} />

                <section className="space-y-1 text-sm">
                  <h3 className="text-sm font-medium">Context</h3>
                  {planner.householdIncluded ? (
                    projection.householdMovesMonths !== null && (
                      <p>
                        {projection.householdMovesMonths === 0
                          ? 'Household goals do not move your date.'
                          : `Household goals move your date by ${plural(Math.abs(projection.householdMovesMonths), 'month')}.`}
                      </p>
                    )
                  ) : (
                    <p className="text-muted-foreground">
                      Household goals not included.
                    </p>
                  )}
                  <p>
                    {projection.savingsRatePct === null
                      ? 'Add a salary to see a savings rate.'
                      : `Savings rate ${Math.round(projection.savingsRatePct)}% of take-home.`}
                  </p>
                  {projection.dividendCoveragePct !== null && (
                    <p>
                      Dividend coverage{' '}
                      {Math.round(projection.dividendCoveragePct)}% of living
                      cost.
                    </p>
                  )}
                  {planner.safetyRelease && (
                    <p className="text-muted-foreground">
                      Once your safety goals are funded (around month{' '}
                      {planner.safetyRelease.fromMonth}),{' '}
                      {money(planner.safetyRelease.monthly)} a month is assumed
                      to join your investing.
                    </p>
                  )}
                </section>

                {levers.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-medium">What could move it</h3>
                    <ul className="space-y-1 text-sm">
                      {(showAllLevers
                        ? levers
                        : visibleFreedomLevers(levers).shown
                      ).map((lever, index) => (
                        <li key={`${lever.kind}-${index}`}>
                          {formatLever(lever, mask, planner.expensesOverridden)}
                        </li>
                      ))}
                    </ul>
                    {visibleFreedomLevers(levers).rest.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllLevers((all) => !all)}
                      >
                        {showAllLevers ? 'Show fewer' : 'Show all'}
                      </Button>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YearlyTable({
  projection,
  now,
  money,
}: {
  projection: FreedomProjection;
  now: Date;
  money: (value: number) => string;
}) {
  if (projection.yearly.length === 0) return null;
  const total = projection.base.months ?? CAP_YEARS * 12;
  const counts = monthsByYear(now, total);
  const rows = projection.yearly.slice(0, MAX_TABLE_ROWS);
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Year by year (base case)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="py-1 pr-3 font-normal">Year</th>
              <th className="py-1 pr-3 text-right font-normal">
                Invested a month
              </th>
              <th className="py-1 text-right font-normal">End balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const months = counts.get(row.year) ?? 12;
              return (
                <tr key={row.year} className="tabular-nums">
                  <td className="py-1 pr-3">
                    {row.year}
                    {months < 12 && (
                      <span className="text-muted-foreground text-xs">
                        {' '}
                        ({plural(months, 'month')})
                      </span>
                    )}
                  </td>
                  <td className="py-1 pr-3 text-right">
                    {money(row.invested / months)}
                  </td>
                  <td className="py-1 text-right">{money(row.endBalance)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {projection.yearly.length > MAX_TABLE_ROWS && (
        <p className="text-muted-foreground text-xs">
          Showing the first {MAX_TABLE_ROWS} years.
        </p>
      )}
    </section>
  );
}
