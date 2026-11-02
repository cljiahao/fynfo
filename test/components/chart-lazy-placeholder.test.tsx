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

// Skeleton height = the chart body's height class in the content module plus
// a 96px allowance for the card header the dynamic boundary also swaps in.
const WRAPPERS: Array<[string, string]> = [
  ['admin/components/marketing-trend-chart', 'h-[416px]'],
  ['assets/components/asset-bar-chart', 'h-[496px]'],
  ['assets/components/category-breakdown', 'h-[216px]'],
  ['assets/components/planner-results', 'h-[346px]'],
  ['equity/components/dividend-income-chart', 'h-[356px]'],
  ['expenses/components/expense-chart', 'h-[336px] sm:h-[446px]'],
  ['salary/components/salary-chart', 'h-[446px]'],
];

const BODY_HEIGHT: Record<string, string> = {
  'admin/components/marketing-trend-chart': 'h-[320px]',
  'assets/components/asset-bar-chart': 'h-[400px]',
  'assets/components/category-breakdown': 'h-[120px]',
  'assets/components/planner-results': 'h-[250px]',
  'equity/components/dividend-income-chart': 'h-[260px]',
  'expenses/components/expense-chart': 'h-[240px] sm:h-[350px]',
  'salary/components/salary-chart': 'h-[350px]',
};

describe('lazy chart wrappers', () => {
  it.each(WRAPPERS)(
    '%s is client-only and renders a card-height placeholder while loading',
    async (path, height) => {
      captured.length = 0;
      await import(`@/features/${path}`);
      expect(captured).toHaveLength(1);
      const [options] = captured;
      expect(options.ssr).toBe(false);
      const { container } = render(<>{options.loading?.()}</>);
      const placeholder = container.querySelector('[data-slot="skeleton"]');
      expect(placeholder).not.toBe(null);
      const classes = (placeholder?.className ?? '').split(/\s+/);
      for (const cls of height.split(' ')) expect(classes).toContain(cls);
    }
  );

  it.each(WRAPPERS)(
    '%s content module still uses the body height this skeleton was sized from',
    (path) => {
      const content = readFileSync(
        resolve(`src/features/${path}-content.tsx`),
        'utf8'
      );
      for (const cls of BODY_HEIGHT[path].split(' ')) {
        expect(content).toContain(cls);
      }
    }
  );
});
