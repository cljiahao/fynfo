// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

interface DynamicOptions {
  ssr?: boolean;
  loading?: () => React.ReactNode;
}

const captured = vi.hoisted(() => [] as DynamicOptions[]);

// Capture the options each wrapper hands to next/dynamic; the vitest stub
// does not model loading or SSR, so this checks the wrapper's contract directly.
vi.mock('next/dynamic', () => ({
  default: (_loader: unknown, options: DynamicOptions) => {
    captured.push(options);
    return () => null;
  },
}));

// Expected skeleton height = the chart div's height class in the content
// module + the card chrome the dynamic boundary also swaps in. The two
// headerless modules render inside callers' cards, so their allowance is 0.
const CARD = 116;

interface Case {
  path: string;
  body: string;
  allowance: number;
  desktopBody?: string;
  desktopAllowance?: number;
}

const CASES: Case[] = [
  {
    path: 'admin/components/marketing-trend-chart',
    body: '320',
    allowance: CARD,
  },
  { path: 'assets/components/asset-bar-chart', body: '400', allowance: CARD },
  {
    path: 'assets/components/category-breakdown',
    body: '120',
    allowance: CARD,
  },
  { path: 'assets/components/planner-results', body: '250', allowance: 0 },
  {
    path: 'equity/components/dividend-income-chart',
    body: '260',
    allowance: 0,
  },
  {
    path: 'expenses/components/expense-chart',
    body: '240',
    allowance: 256,
    desktopBody: '350',
    desktopAllowance: 164,
  },
  { path: 'salary/components/salary-chart', body: '350', allowance: CARD },
];

// planner-results stacks into two cells below sm, so its mobile skeleton is
// the stacked height (chart 250 + gap 24 + ~200 summary), not body + allowance.
const MOBILE_OVERRIDE: Record<string, number> = {
  'assets/components/planner-results': 474,
};

describe('lazy chart wrappers', () => {
  it.each(CASES)(
    '$path skeleton height is body + card allowance',
    async (c) => {
      captured.length = 0;
      await import(`@/features/${c.path}`);
      expect(captured).toHaveLength(1);
      const [options] = captured;
      expect(options.ssr).toBe(false);
      const { container } = render(<>{options.loading?.()}</>);
      const placeholder = container.querySelector('[data-slot="skeleton"]');
      expect(placeholder).not.toBe(null);
      const classes = (placeholder?.className ?? '').split(/\s+/);
      const mobile = MOBILE_OVERRIDE[c.path] ?? Number(c.body) + c.allowance;
      expect(classes).toContain(`h-[${mobile}px]`);
      if (c.desktopBody) {
        const desktop = Number(c.desktopBody) + (c.desktopAllowance ?? 0);
        expect(classes).toContain(`sm:h-[${desktop}px]`);
      } else if (MOBILE_OVERRIDE[c.path]) {
        expect(classes).toContain(`sm:h-[${Number(c.body) + c.allowance}px]`);
      }
    }
  );

  it.each(CASES)('$path chart div uses the body height class', (c) => {
    const content = readFileSync(
      resolve(`src/features/${c.path}-content.tsx`),
      'utf8'
    );
    const chartDiv = new RegExp(
      String.raw`<div className="[^"]*\bh-\[${c.body}px\][^"]*">[\s\S]{0,160}?<ResponsiveContainer`
    );
    expect(content).toMatch(chartDiv);
  });
});
