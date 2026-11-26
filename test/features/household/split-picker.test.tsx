// @vitest-environment jsdom
import { SplitPicker } from '@/features/household/components/split-picker';
import { pctMapToText, type PctText } from '@/features/household/split-utils';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const IDS = ['a', 'b', 'c'];
const NAMES: Record<string, string> = {
  a: 'You',
  b: 'Member 1',
  c: 'Member 2',
};

vi.mock('@/features/household/hooks/use-member-labels', () => ({
  useMemberLabels: () => ({ label: (id: string) => NAMES[id] }),
}));

function Harness({ initial }: { initial: Record<string, number> }) {
  const [value, setValue] = useState<PctText>(pctMapToText(initial, IDS));
  return (
    <SplitPicker
      label="Who shares"
      memberIds={IDS}
      value={value}
      onChange={setValue}
    />
  );
}

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

afterEach(cleanup);

describe('SplitPicker', () => {
  it('shows an even split over the sharing members', () => {
    render(<Harness initial={{ a: 34, b: 33, c: 33 }} />);
    expect(pressed('Custom')).toBe('false');
    expect(
      screen.getByText('You 34%, Member 1 33%, Member 2 33%')
    ).toBeVisible();
  });

  it('re-splits evenly when a member is toggled off and on', async () => {
    render(<Harness initial={{ a: 34, b: 33, c: 33 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Member 2' }));
    expect(pressed('Member 2')).toBe('false');
    expect(screen.getByText('You 50%, Member 1 50%')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Member 2' }));
    expect(
      screen.getByText('You 34%, Member 1 33%, Member 2 33%')
    ).toBeVisible();
  });

  it('keeps at least one member sharing', async () => {
    render(<Harness initial={{ a: 100, b: 0, c: 0 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'You' }));
    expect(pressed('You')).toBe('true');
  });

  it('opens custom rows for an uneven split and shows the remainder', async () => {
    render(<Harness initial={{ a: 50, b: 50, c: 0 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const field = screen.getByLabelText('You share (%)');
    await userEvent.clear(field);
    await userEvent.type(field, '35');
    expect(pressed('Custom')).toBe('true');
    expect(screen.getByText('15% left to assign')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/total 100/i);
  });

  it('treats a stored uneven split as custom and totals to 100', () => {
    render(<Harness initial={{ a: 50, b: 30, c: 20 }} />);
    expect(pressed('Custom')).toBe('true');
    expect(screen.getByText('Total 100%')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('flags an invalid custom percentage', async () => {
    render(<Harness initial={{ a: 50, b: 30, c: 20 }} />);
    const field = screen.getByLabelText('You share (%)');
    await userEvent.clear(field);
    await userEvent.type(field, '150');
    expect(screen.getByRole('alert')).toHaveTextContent(/0 to 100/);
  });
});
