// @vitest-environment jsdom
import DashboardError from '@/app/dashboard/(overview)/error';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const withDigest = Object.assign(new Error('boom'), { digest: 'abc123' });

describe('DashboardError', () => {
  it('renders the failure message and the digest reference', () => {
    render(<DashboardError error={withDigest} reset={() => {}} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it('omits the reference line when the error has no digest', () => {
    render(<DashboardError error={new Error('boom')} reset={() => {}} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it('calls reset when "Try again" is clicked', async () => {
    const reset = vi.fn();
    render(<DashboardError error={new Error('boom')} reset={reset} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
