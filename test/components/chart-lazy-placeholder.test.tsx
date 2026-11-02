// @vitest-environment jsdom
import { render } from '@testing-library/react';
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

const WRAPPERS = [
  '@/features/admin/components/marketing-trend-chart',
  '@/features/assets/components/asset-bar-chart',
  '@/features/assets/components/category-breakdown',
  '@/features/assets/components/planner-results',
  '@/features/equity/components/dividend-income-chart',
  '@/features/expenses/components/expense-chart',
  '@/features/salary/components/salary-chart',
];

describe('lazy chart wrappers', () => {
  it.each(WRAPPERS)(
    '%s is client-only and renders a sized placeholder while loading',
    async (path) => {
      captured.length = 0;
      await import(path);
      expect(captured).toHaveLength(1);
      const [options] = captured;
      expect(options.ssr).toBe(false);
      const { container } = render(<>{options.loading?.()}</>);
      const placeholder = container.querySelector('[data-slot="skeleton"]');
      expect(placeholder).not.toBe(null);
      expect(placeholder?.className).toMatch(/\bh-\[\d+px\]/);
    }
  );
});
