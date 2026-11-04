// @vitest-environment jsdom
import { NumericInput } from '@/components/numeric-input';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

function Harness({ onValue }: { onValue?: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <>
      <NumericInput
        aria-label="Shares"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
      />
      <output data-testid="state">{value === null ? 'null' : value}</output>
    </>
  );
}

afterEach(cleanup);

describe('NumericInput', () => {
  it('shows exactly what is typed without a leading zero', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Shares');
    await user.type(input, '3500');
    expect(input).toHaveValue('3500');
    expect(screen.getByTestId('state')).toHaveTextContent('3500');
  });

  it('can be cleared and emits null', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Shares');
    await user.type(input, '12');
    await user.clear(input);
    expect(input).toHaveValue('');
    expect(onValue).toHaveBeenLastCalledWith(null);
  });

  it('keeps partial decimals while editing and normalizes on blur', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Shares');
    await user.type(input, '1.');
    expect(input).toHaveValue('1.');
    await user.tab();
    expect(input).toHaveValue('1');
  });
});
