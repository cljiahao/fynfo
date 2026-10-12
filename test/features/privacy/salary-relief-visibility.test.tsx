// @vitest-environment jsdom
import {
  AmountVisibilityProvider,
  AmountVisibilityToggle,
} from '@/features/privacy';
import { SalarySummary } from '@/features/salary/components/salary-summary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  getProfile: vi.fn(),
  upsertProfile: vi.fn(),
  getTaxReliefs: vi.fn(),
  upsertTaxReliefs: vi.fn(),
}));
vi.mock('@/features/profile/actions/profile-actions', () => ({
  getProfile: api.getProfile,
  upsertProfile: api.upsertProfile,
}));
vi.mock('@/features/salary/actions/relief-actions', () => ({
  getTaxReliefs: api.getTaxReliefs,
  upsertTaxReliefs: api.upsertTaxReliefs,
}));
let client: QueryClient;
beforeEach(() => {
  vi.resetAllMocks();
  api.getProfile.mockResolvedValue({
    birthYear: 1990,
    isNsman: false,
    residencyStatus: 'resident',
  });
  api.getTaxReliefs.mockResolvedValue([
    { reliefKey: 'parent', amount: 5500 },
    { reliefKey: 'child', amount: 12000 },
  ]);
});
afterEach(() => {
  cleanup();
  client?.clear();
});
it('conceals selected monetary relief tiers and counts while preserving fixed assumptions', async () => {
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  const year = new Date().getFullYear();
  const view = render(
    <QueryClientProvider client={client}>
      <AmountVisibilityProvider>
        <AmountVisibilityToggle />
        <SalarySummary
          records={[{ id: `${year}-01`, salary: 5000, bonus: 0 }]}
        />
      </AmountVisibilityProvider>
    </QueryClientProvider>
  );
  const triggers = await screen.findAllByRole('button', {
    name: 'Relief breakdown',
  });
  for (const trigger of triggers) fireEvent.click(trigger);
  expect(screen.getAllByText('Parent Relief — Not staying')).toHaveLength(2);
  expect(view.container.textContent).toContain('×3');
  fireEvent.click(screen.getByRole('button', { name: 'Hide amounts' }));
  expect(screen.getAllByText('Parent Relief')).toHaveLength(2);
  expect(view.container.textContent).not.toContain('Not staying');
  expect(view.container.textContent).not.toContain('×3');
  expect(view.container.textContent).not.toContain('5,500.00');
  expect(view.container.textContent).toContain('age 55 and below');
  expect(view.container.textContent).toContain('SGD 80,000');
  fireEvent.click(screen.getByRole('button', { name: 'Show amounts' }));
  expect(screen.getAllByText('Parent Relief — Not staying')).toHaveLength(2);
  expect(view.container.textContent).toContain('×3');
});
