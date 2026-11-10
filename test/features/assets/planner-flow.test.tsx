// @vitest-environment jsdom
import { PlannerFlow } from '@/features/assets/components/planner-flow';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('PlannerFlow legend rows', () => {
  it('shows the full expandable label, a 40px toggle and a chevron that follows aria-expanded', async () => {
    const { container } = render(
      <AmountVisibilityProvider>
        <PlannerFlow
          net={5000}
          stateLine="On track"
          segments={[
            {
              key: 'household',
              label: 'Set aside this month',
              amount: 800,
              pct: 0.16,
              color: '#123456',
              details: <p>Detail rows</p>,
            },
            {
              key: 'savings',
              label: 'Savings',
              amount: 400,
              pct: 0.08,
              color: '#654321',
            },
          ]}
        />
      </AmountVisibilityProvider>
    );
    const toggle = screen.getByRole('button', { name: /Set aside this month/ });
    expect(toggle).toHaveClass('min-h-10');
    expect(toggle.querySelector('span')).not.toHaveClass('truncate');

    const chevron = () => toggle.querySelector('svg.lucide-chevron-down');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(chevron()).toHaveClass('-rotate-90');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(chevron()).not.toHaveClass('-rotate-90');
    expect(screen.getByText('Detail rows')).toBeInTheDocument();

    const rows = container.querySelectorAll('li');
    expect(rows[1].querySelector('svg.lucide-chevron-down')).toBeNull();
  });
});
