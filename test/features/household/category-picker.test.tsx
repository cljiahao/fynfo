// @vitest-environment jsdom
import { CategoryPicker } from '@/features/household/components/category-picker';
import type { CategoryOption } from '@/features/household/lib/spending-stats';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

const options: CategoryOption[] = [
  { label: 'Groceries', budgeted: true },
  { label: 'Dining', budgeted: false },
];

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <label htmlFor="cat">Category</label>
      <CategoryPicker
        id="cat"
        options={options}
        value={value}
        onValueChange={setValue}
      />
    </>
  );
}

afterEach(cleanup);

describe('CategoryPicker', () => {
  it('lists budgeted categories before used ones on focus', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText('Category'));
    const labels = screen.getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['GroceriesBudgeted', 'Dining']);
  });

  it('offers a Use new category row for an unknown name and accepts it', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Category');
    await userEvent.type(input, 'Pets');
    const row = screen.getByRole('option', { name: /Use new category: Pets/ });
    await userEvent.click(row);
    expect(input).toHaveValue('Pets');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('does not offer a new-category row for a case or whitespace variant', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Category'), ' GROCERIES');
    expect(
      screen.queryByRole('option', { name: /Use new category/ })
    ).toBeNull();
    expect(
      screen.getByRole('option', { name: /Groceries/ })
    ).toBeInTheDocument();
  });

  it('selects with the keyboard', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Category');
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(input).toHaveValue('Dining');
  });
});
