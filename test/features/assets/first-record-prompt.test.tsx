// @vitest-environment jsdom
import { FirstRecordPrompt } from '@/features/assets';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

it('offers real record routes and remembers Skip across remounts in the tab', () => {
  render(<FirstRecordPrompt />);
  expect(
    screen
      .getByRole('link', { name: 'Add your first snapshot' })
      .getAttribute('href')
  ).toBe('/dashboard/entry');
  expect(
    screen
      .getByRole('link', { name: 'Start with an expense' })
      .getAttribute('href')
  ).toBe('/dashboard/expenses');
  fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
  expect(
    screen.queryByRole('heading', { name: 'Start with your current assets' })
  ).toBeNull();
  cleanup();
  render(<FirstRecordPrompt />);
  expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
});
