// @vitest-environment jsdom
import { Hero } from '@/features/marketing/components/hero';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// next/font is a build-time transform; stub it for the runtime test.
vi.mock('next/font/google', () => ({
  Fraunces: () => ({ className: 'font-fraunces', variable: '--font-fraunces' }),
}));

beforeAll(() => {
  // framer-motion's useReducedMotion reads matchMedia, absent in jsdom.
  window.matchMedia =
    window.matchMedia ||
    ((query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList);
});

afterEach(cleanup);

describe('Hero', () => {
  it('renders the headline and a Get started link to /login', () => {
    render(<Hero />);
    expect(screen.getByText(/one pulse away/i)).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /get started/i });
    expect(cta).toHaveAttribute('href', '/login');
  });
});
