// @vitest-environment jsdom
import { TimelineList } from '@/features/investment-api/components/timeline-list';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(cleanup);

const base = {
  id: '',
  caller: 'ballast',
  eventType: 'plan' as const,
  occurredAt: '2026-11-27T10:00:00+00:00',
  payload: '{"note":"buy"}',
};

describe('TimelineList', () => {
  it('shows an empty state without events', () => {
    render(<TimelineList events={[]} />);
    expect(screen.getByText(/No journal events yet/)).toBeInTheDocument();
  });

  it('groups by date, newest day first, with caller, type and payload', () => {
    render(
      <TimelineList
        events={[
          { ...base, id: 'a', occurredAt: '2026-11-26T09:00:00+00:00' },
          { ...base, id: 'b', caller: 'acciaux', eventType: 'verdict' },
          { ...base, id: 'c', occurredAt: '2026-11-27T12:00:00+00:00' },
        ]}
      />
    );
    const days = screen.getAllByRole('region');
    expect(days.map((d) => d.getAttribute('aria-label'))).toEqual([
      '2026-11-27',
      '2026-11-26',
    ]);
    const first = within(days[0]!);
    expect(first.getAllByRole('listitem')).toHaveLength(2);
    expect(first.getByText('acciaux')).toBeInTheDocument();
    expect(first.getByText('Verdict')).toBeInTheDocument();
    expect(within(days[1]!).getByText('{"note":"buy"}')).toBeInTheDocument();
  });

  it('shows "could not open" with no detail for an unopenable event', () => {
    render(<TimelineList events={[{ ...base, id: 'x', payload: null }]} />);
    expect(screen.getByText('could not open')).toBeInTheDocument();
    expect(screen.getByText('ballast')).toBeInTheDocument();
  });
});
