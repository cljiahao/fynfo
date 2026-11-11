import { expenseCoverage } from '@/features/equity';

export const DEFAULT_CAP_MONTHS = 720;
export const DEFAULT_RETURN_SPREAD_PCT = 2;
export const MAX_VISIBLE_LEVERS = 3;

const GOAL_END_WINDOW_MONTHS = 60;
const EMERGENCY_SURPLUS_MIN = 1000;
const EXPENSE_DRIFT_THRESHOLD_PCT = 10;

export interface FreedomInput {
  now: Date;
  /** Invested portfolio today. */
  portfolio: number;
  annualCost: number;
  withdrawalRatePct: number | null;
  realReturnPct: number | null;
  /** Percentage points either side of the base return for the low and high runs. */
  returnSpreadPct: number;
  targetYear: number | null;
  /** Monthly investing today. */
  monthlyInvesting: number;
  /** Safety savings that join investing from `fromMonth` (month 1 is the month after `now`). */
  safetyRelease: { monthly: number; fromMonth: number } | null;
  /** Household goal set-aside per month today. */
  householdGoalsToday: number;
  /** Element k is the average monthly goal set-aside in future year k; missing years read as 0. */
  householdGoalsMonthlyByYear: number[];
  netMonthlyIncome: number | null;
  savingsMonthly: number;
  dividendAvgMonthly: number | null;
  capMonths?: number;
}

export interface FreedomRun {
  /** Null when the freedom number is not reached within the cap. */
  months: number | null;
  /** YYYY-MM of the projected month. */
  date: string | null;
  reached: boolean;
}

export interface FreedomYear {
  /** Calendar year of the months grouped here; the first and last years can be partial. */
  year: number;
  /** Total invested during these months. */
  invested: number;
  endBalance: number;
}

export type FreedomStatus =
  | 'ok'
  | 'no_assumptions'
  | 'no_expenses'
  | 'no_portfolio'
  | 'invalid';

export interface FreedomProjection {
  status: FreedomStatus;
  freedomNumber: number | null;
  progressPct: number | null;
  low: FreedomRun;
  base: FreedomRun;
  high: FreedomRun;
  onTrackForTarget: boolean | null;
  savingsRatePct: number | null;
  dividendCoveragePct: number | null;
  /** Base months with the goal schedule minus base months without; positive delays freedom. */
  householdMovesMonths: number | null;
  yearly: FreedomYear[];
}

export interface FreedomGoalEnd {
  goalId: string;
  name: string;
  /** YYYY-MM. */
  endMonth: string;
  extraInvesting: number;
}

export interface LeverContext {
  /** savings + bonds - emergencyFundGoal - warChestGoal - householdEarmark, before the 1,000 floor. */
  surplusAfterEarmark: number;
  expenseDriftPct: number | null;
  /** Soonest end first; empty when household is unavailable. */
  householdGoalEnds: FreedomGoalEnd[];
}

export type FreedomLever =
  | { kind: 'extra-monthly'; amount: number; monthsEarlier: number }
  | { kind: 'expense-drift'; driftPct: number; monthsLater: number }
  | { kind: 'emergency-surplus'; amount: number }
  | ({ kind: 'household-goal-ends' } & FreedomGoalEnd);

export interface LeverOptions {
  /** Applied to household goal names so a hidden-amounts view never leaks them. */
  maskName?: (name: string) => string;
}

const NOT_REACHED: FreedomRun = { months: null, date: null, reached: false };

function addMonthsLabel(now: Date, months: number): string {
  const total = now.getMonth() + months;
  const year = now.getFullYear() + Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function runOf(now: Date, months: number | null): FreedomRun {
  if (months === null) return NOT_REACHED;
  return {
    months,
    date: addMonthsLabel(now, months),
    reached: months === 0,
  };
}

function finite(n: number): boolean {
  return Number.isFinite(n);
}

function monthlyRate(returnPct: number): number {
  return Math.pow(1 + returnPct / 100, 1 / 12) - 1;
}

interface SimulateArgs {
  portfolio: number;
  target: number;
  returnPct: number;
  cap: number;
  contribution: (month: number) => number;
  onMonth?: (month: number, balance: number, contributed: number) => void;
}

function simulate(args: SimulateArgs): number | null {
  if (args.portfolio >= args.target) return 0;
  const rm = monthlyRate(args.returnPct);
  let balance = args.portfolio;
  for (let t = 1; t <= args.cap; t += 1) {
    const c = args.contribution(t);
    balance = balance * (1 + rm) + c;
    args.onMonth?.(t, balance, c);
    if (balance >= args.target) return t;
  }
  return null;
}

function contributionFn(
  input: FreedomInput,
  withGoalSchedule: boolean,
  extra = 0
): (month: number) => number {
  const series = input.householdGoalsMonthlyByYear;
  const release = input.safetyRelease;
  return (month) => {
    const year = Math.floor((month - 1) / 12);
    const investing = withGoalSchedule
      ? Math.max(
          0,
          input.monthlyInvesting +
            input.householdGoalsToday -
            finiteOrZero(series[year])
        )
      : input.monthlyInvesting + input.householdGoalsToday;
    const released =
      release !== null && month >= release.fromMonth ? release.monthly : 0;
    return Math.max(0, investing + extra) + released;
  };
}

function finiteOrZero(n: number | undefined): number {
  return n !== undefined && Number.isFinite(n) ? n : 0;
}

function monthsFor(
  input: FreedomInput,
  target: number,
  returnPct: number,
  withGoalSchedule: boolean,
  extra = 0
): number | null {
  return simulate({
    portfolio: input.portfolio,
    target,
    returnPct,
    cap: input.capMonths ?? DEFAULT_CAP_MONTHS,
    contribution: contributionFn(input, withGoalSchedule, extra),
  });
}

function inputsAreFinite(input: FreedomInput): boolean {
  return (
    finite(input.portfolio) &&
    finite(input.annualCost) &&
    finite(input.monthlyInvesting) &&
    finite(input.householdGoalsToday) &&
    finite(input.returnSpreadPct) &&
    finite(input.savingsMonthly) &&
    (input.withdrawalRatePct === null || finite(input.withdrawalRatePct)) &&
    (input.realReturnPct === null || finite(input.realReturnPct)) &&
    (input.safetyRelease === null ||
      (finite(input.safetyRelease.monthly) &&
        finite(input.safetyRelease.fromMonth)))
  );
}

function emptyProjection(status: FreedomStatus): FreedomProjection {
  return {
    status,
    freedomNumber: null,
    progressPct: null,
    low: NOT_REACHED,
    base: NOT_REACHED,
    high: NOT_REACHED,
    onTrackForTarget: null,
    savingsRatePct: null,
    dividendCoveragePct: null,
    householdMovesMonths: null,
    yearly: [],
  };
}

function savingsRate(input: FreedomInput): number | null {
  const net = input.netMonthlyIncome;
  if (net === null || !finite(net) || net <= 0) return null;
  return ((input.monthlyInvesting + input.savingsMonthly) / net) * 100;
}

function dividendCoverage(input: FreedomInput): number | null {
  if (input.dividendAvgMonthly === null) return null;
  const coverage = expenseCoverage(
    input.dividendAvgMonthly,
    input.annualCost / 12
  );
  return coverage === null ? null : coverage * 100;
}

function yearlyTable(
  input: FreedomInput,
  target: number,
  returnPct: number
): FreedomYear[] {
  const rows: FreedomYear[] = [];
  const startYear = input.now.getFullYear();
  const startMonth = input.now.getMonth();
  simulate({
    portfolio: input.portfolio,
    target,
    returnPct,
    cap: input.capMonths ?? DEFAULT_CAP_MONTHS,
    contribution: contributionFn(input, true),
    onMonth: (t, balance, contributed) => {
      const year = startYear + Math.floor((startMonth + t) / 12);
      const last = rows[rows.length - 1];
      if (last !== undefined && last.year === year) {
        last.invested += contributed;
        last.endBalance = balance;
      } else {
        rows.push({ year, invested: contributed, endBalance: balance });
      }
    },
  });
  return rows;
}

export function projectFreedom(input: FreedomInput): FreedomProjection {
  const w = input.withdrawalRatePct;
  if (!inputsAreFinite(input) || (w !== null && w <= 0)) {
    return emptyProjection('invalid');
  }
  if (w === null || input.realReturnPct === null) {
    return emptyProjection('no_assumptions');
  }
  if (input.annualCost <= 0) return emptyProjection('no_expenses');

  const freedomNumber = input.annualCost / (w / 100);
  const spread = input.returnSpreadPct;
  const baseReturn = input.realReturnPct;
  const lowMonths = monthsFor(
    input,
    freedomNumber,
    Math.max(0, baseReturn - spread),
    true
  );
  const baseMonths = monthsFor(input, freedomNumber, baseReturn, true);
  const highMonths = monthsFor(input, freedomNumber, baseReturn + spread, true);
  const base = runOf(input.now, baseMonths);

  const withoutGoals = monthsFor(input, freedomNumber, baseReturn, false);
  const householdMovesMonths =
    baseMonths === null || withoutGoals === null
      ? null
      : baseMonths - withoutGoals;

  let onTrackForTarget: boolean | null = null;
  if (input.targetYear !== null) {
    onTrackForTarget =
      base.date !== null && Number(base.date.slice(0, 4)) <= input.targetYear;
  }

  return {
    status: input.portfolio > 0 ? 'ok' : 'no_portfolio',
    freedomNumber,
    progressPct: Math.min(
      100,
      Math.max(0, (input.portfolio / freedomNumber) * 100)
    ),
    low: runOf(input.now, lowMonths),
    base,
    high: runOf(input.now, highMonths),
    onTrackForTarget,
    savingsRatePct: savingsRate(input),
    dividendCoveragePct: dividendCoverage(input),
    householdMovesMonths,
    yearly: yearlyTable(input, freedomNumber, baseReturn),
  };
}

function monthIndex(label: string): number | null {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (match === null) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function leverMonthsMoved(lever: FreedomLever): number {
  if (lever.kind === 'extra-monthly') return lever.monthsEarlier;
  if (lever.kind === 'expense-drift') return lever.monthsLater;
  return 0;
}

/**
 * Rule-based levers, largest months moved first, then in the spec's listed order.
 * Returns every lever that fires; callers show `MAX_VISIBLE_LEVERS` and keep the rest
 * behind "Show all". Names no asset, fund or platform.
 */
export function computeFreedomLevers(
  input: FreedomInput,
  context: LeverContext,
  options: LeverOptions = {}
): FreedomLever[] {
  const projection = projectFreedom(input);
  if (
    (projection.status !== 'ok' && projection.status !== 'no_portfolio') ||
    projection.base.months === null ||
    projection.freedomNumber === null ||
    input.realReturnPct === null
  ) {
    return [];
  }
  const baseMonths = projection.base.months;
  const target = projection.freedomNumber;
  const returnPct = input.realReturnPct;
  const levers: FreedomLever[] = [];

  if (baseMonths > 0) {
    const step = Math.max(
      100,
      Math.round((input.monthlyInvesting * 0.1) / 50) * 50
    );
    const faster = monthsFor(input, target, returnPct, true, step);
    if (faster !== null && baseMonths - faster >= 1) {
      levers.push({
        kind: 'extra-monthly',
        amount: step,
        monthsEarlier: baseMonths - faster,
      });
    }
  }

  const drift = context.expenseDriftPct;
  if (drift !== null && finite(drift) && drift > EXPENSE_DRIFT_THRESHOLD_PCT) {
    const slower = monthsFor(
      input,
      (target * (100 + drift)) / 100,
      returnPct,
      true
    );
    if (slower !== null && slower - baseMonths >= 1) {
      levers.push({
        kind: 'expense-drift',
        driftPct: Math.round(drift),
        monthsLater: slower - baseMonths,
      });
    }
  }

  if (
    finite(context.surplusAfterEarmark) &&
    context.surplusAfterEarmark >= EMERGENCY_SURPLUS_MIN
  ) {
    levers.push({
      kind: 'emergency-surplus',
      amount: Math.floor(context.surplusAfterEarmark / 100) * 100,
    });
  }

  const nowIndex = input.now.getFullYear() * 12 + input.now.getMonth();
  const goalLevers: FreedomLever[] = [];
  for (const goal of context.householdGoalEnds) {
    const end = monthIndex(goal.endMonth);
    if (end === null) continue;
    const away = end - nowIndex;
    if (away < 0 || away > GOAL_END_WINDOW_MONTHS) continue;
    goalLevers.push({
      kind: 'household-goal-ends',
      goalId: goal.goalId,
      name: options.maskName ? options.maskName(goal.name) : goal.name,
      endMonth: goal.endMonth,
      extraInvesting: Math.max(0, goal.extraInvesting),
    });
  }
  goalLevers.sort(
    (a, b) =>
      (a.kind === 'household-goal-ends' ? (monthIndex(a.endMonth) ?? 0) : 0) -
      (b.kind === 'household-goal-ends' ? (monthIndex(b.endMonth) ?? 0) : 0)
  );
  levers.push(...goalLevers);

  return levers
    .map((lever, order) => ({ lever, order }))
    .sort(
      (a, b) =>
        leverMonthsMoved(b.lever) - leverMonthsMoved(a.lever) ||
        a.order - b.order
    )
    .map(({ lever }) => lever);
}

export function visibleFreedomLevers(
  levers: FreedomLever[],
  max = MAX_VISIBLE_LEVERS
): { shown: FreedomLever[]; rest: FreedomLever[] } {
  return { shown: levers.slice(0, max), rest: levers.slice(max) };
}
