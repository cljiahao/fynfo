// @vitest-environment jsdom
import { PageHeader } from '@/components/widgets';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader title="Assets" />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Assets' })
    ).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Assets" description="Track your assets" />);
    expect(screen.getByText('Track your assets')).toBeInTheDocument();
  });

  it('renders the action slot', () => {
    render(
      <PageHeader title="Assets" action={<button type="button">Add</button>} />
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('omits the description paragraph when not provided', () => {
    const { container } = render(<PageHeader title="Assets" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
