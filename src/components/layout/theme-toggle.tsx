'use client';

import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const;

// Theme switcher for the user menu (spec feature/003). Designed to be dropped
// inside the existing DropdownMenuContent. Renders no theme-dependent markup, so
// no `mounted` hydration guard is needed — server and first client paint match.
export function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <>
      {OPTIONS.map(({ value, label, Icon }) => (
        <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
          <Icon className="mr-2 size-4" />
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
