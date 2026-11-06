// @vitest-environment jsdom
import { SplitPicker } from '@/features/household/components/split-picker';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <SplitPicker label="Your share" value={value} onChange={setValue} />;
}

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');

afterEach(cleanup);

describe('SplitPicker', () => {
  it.each([
    ['50', '50/50'],
    ['100', 'Just me'],
    ['0', 'Just partner'],
    ['70', 'Custom'],
  ])('selects the preset matching %s%%', (initial, preset) => {
    render(<Harness initial={initial} />);
    expect(pressed(preset)).toBe('true');
  });

  it('sets the percentage from each preset', async () => {
    render(<Harness initial="50" />);
    await userEvent.click(screen.getByRole('button', { name: 'Just me' }));
    expect(pressed('Just me')).toBe('true');
    expect(screen.getByText('You 100%, partner 0%')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Just partner' }));
    expect(pressed('Just partner')).toBe('true');
    expect(screen.getByText('You 0%, partner 100%')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: '50/50' }));
    expect(pressed('50/50')).toBe('true');
  });

  it('accepts a custom percentage and shows the partner share', async () => {
    render(<Harness initial="50" />);
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const field = screen.getByLabelText('Your share (%)');
    await userEvent.clear(field);
    await userEvent.type(field, '35');
    expect(pressed('Custom')).toBe('true');
    expect(screen.getByText('Partner: 65%')).toBeVisible();
  });

  it('flags an invalid custom percentage', async () => {
    render(<Harness initial="50" />);
    await userEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const field = screen.getByLabelText('Your share (%)');
    await userEvent.clear(field);
    await userEvent.type(field, '150');
    expect(screen.getByRole('alert')).toHaveTextContent(/0 to 100/);
  });
});
