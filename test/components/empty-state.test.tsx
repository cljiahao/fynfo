// @vitest-environment jsdom
import { EmptyState } from '@/components/widgets';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(
      <EmptyState title="No snapshots yet" description="Add your first" />
    );
    expect(screen.getByText('No snapshots yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first')).toBeInTheDocument();
  });

  it('renders the action node when provided', () => {
    render(
      <EmptyState title="Empty" action={<button type="button">Add</button>} />
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});
