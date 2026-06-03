// @vitest-environment jsdom
import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setTheme = vi.fn();

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme }),
}));

afterEach(() => {
  cleanup();
  setTheme.mockReset();
});

function renderToggle() {
  return render(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ThemeToggle />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('ThemeToggle', () => {
  it('renders Light, Dark, and System options', () => {
    renderToggle();
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('calls setTheme with the selected value', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByText('Dark'));
    expect(setTheme).toHaveBeenCalledWith('dark');

    await user.click(screen.getByText('System'));
    expect(setTheme).toHaveBeenCalledWith('system');

    await user.click(screen.getByText('Light'));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
