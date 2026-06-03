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

// Open the submenu via the keyboard. Pointer hit-testing relies on layout
// geometry that jsdom can't provide (radix's safe-triangle drops the click);
// keyboard navigation is geometry-free and is radix's other supported path.
async function openSubmenu(user: ReturnType<typeof userEvent.setup>) {
  screen.getByRole('menuitem', { name: 'Theme' }).focus();
  await user.keyboard('{Enter}');
  await screen.findByRole('menuitemradio', { name: 'Light' });
}

describe('ThemeToggle', () => {
  it('exposes a Theme sub-trigger that reveals Light/Dark/System', async () => {
    const user = userEvent.setup();
    renderToggle();

    expect(screen.getByRole('menuitem', { name: 'Theme' })).toBeInTheDocument();
    await openSubmenu(user);

    expect(
      screen.getByRole('menuitemradio', { name: 'Light' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'Dark' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', { name: 'System' })
    ).toBeInTheDocument();
  });

  it('calls setTheme with the chosen value on select', async () => {
    const user = userEvent.setup();
    renderToggle();
    await openSubmenu(user);

    // Submenu opens with focus on the first item (Light); step down to Dark.
    await user.keyboard('{ArrowDown}{Enter}');
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
