// @vitest-environment jsdom
import HomePage from '@/app/(public)/page';
import { PageViewTracker } from '@/features/marketing/components/page-view-tracker';
import { TrackedCtaLink } from '@/features/marketing/components/tracked-cta-link';
import { FAQ_ITEMS } from '@/features/marketing/constants';
import { trackEvent } from '@/features/marketing/lib/track';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('next/font/google', () => ({
  Fraunces: () => ({ className: 'fixture-font' }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  route.pathname = '/';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: true,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('storefront workflow', () => {
  it('renders the public product story and reveals FAQ answers on demand', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: 'Questions, answered' })
    ).toBeTruthy();
    for (const item of FAQ_ITEMS) {
      fireEvent.click(screen.getByRole('button', { name: item.question }));
      expect(screen.getByText(item.answer)).toBeTruthy();
    }
    expect(
      screen
        .getAllByRole('link')
        .some((link) => link.getAttribute('href') === '/login')
    ).toBe(true);
  });

  it('sends one page beacon under strict effects and another for a changed pathname', () => {
    const view = render(
      <StrictMode>
        <PageViewTracker />
      </StrictMode>
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(
      JSON.parse(
        (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string
      )
    ).toEqual({ eventType: 'page_view', path: '/' });
    route.pathname = '/login';
    view.rerender(
      <StrictMode>
        <PageViewTracker />
      </StrictMode>
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves a CTA callback while telemetry fails', () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fixture unavailable'));
    const click = vi.fn((event: React.MouseEvent) => event.preventDefault());
    render(
      <TrackedCtaLink href="/login" onClick={click}>
        Start fixture
      </TrackedCtaLink>
    );
    fireEvent.click(screen.getByRole('link', { name: 'Start fixture' }));
    expect(click).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      '/api/track',
      expect.objectContaining({ method: 'POST', keepalive: true })
    );
  });

  it('never throws when fetch itself is unavailable', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('fixture synchronous failure');
    });
    expect(() => trackEvent('page_view', '/')).not.toThrow();
  });
});
