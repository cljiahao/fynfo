// @vitest-environment jsdom
import { StatCard } from '@/components/widgets';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('StatCard', () => {
  it('renders label, value, and hint', () => {
    render(<StatCard label="Total Assets" value="S$1,234" hint="2026-05" />);
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
    expect(screen.getByText('S$1,234')).toBeInTheDocument();
    expect(screen.getByText('2026-05')).toBeInTheDocument();
  });

  it('applies the gain tone to the value', () => {
    render(<StatCard label="P&L" value="+S$500" tone="gain" />);
    expect(screen.getByText('+S$500')).toHaveClass('text-gain');
  });

  it('applies the loss tone to the value', () => {
    render(<StatCard label="P&L" value="-S$500" tone="loss" />);
    expect(screen.getByText('-S$500')).toHaveClass('text-loss');
  });

  it('renders an up-trend arrow when trend is up', () => {
    const { container } = render(
      <StatCard label="Change" value="+5%" trend="up" />
    );
    expect(container.querySelector('.lucide-arrow-up')).toBeInTheDocument();
  });

  it('renders children (breakdown rows)', () => {
    render(
      <StatCard label="Total" value="S$1,000">
        <span>breakdown</span>
      </StatCard>
    );
    expect(screen.getByText('breakdown')).toBeInTheDocument();
  });
});
