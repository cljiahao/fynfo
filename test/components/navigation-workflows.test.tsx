// @vitest-environment jsdom
import { DashboardNavbar } from '@/components/layout/dashboard-navbar';
import { SiteFooter } from '@/components/layout/site-footer';
import { PaginationControls } from '@/components/widgets/pagination-controls';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/dashboard/assets/entry' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('dashboard navigation', () => {
  it.each([
    ['Dashboard', '/dashboard'],
    ['Assets', '/dashboard/assets'],
    ['Salary', '/dashboard/salary'],
    ['Equity', '/dashboard/equity'],
    ['Expenses', '/dashboard/expenses'],
    ['Household', '/dashboard/household'],
  ])('links %s to its matching page', (name, href) => {
    render(<DashboardNavbar />);
    expect(screen.getByRole('link', { name }).getAttribute('href')).toBe(href);
  });
  it('provides a real help destination in the footer', () => {
    render(<SiteFooter />);
    expect(
      screen.getByRole('link', { name: 'Help' }).getAttribute('href')
    ).toBe('/#faq');
  });
  it('opens the mobile menu and closes it after selecting a destination', async () => {
    render(<DashboardNavbar userMenu={<button>Fixture account</button>} />);
    expect(
      screen.getAllByRole('button', { name: 'Fixture account' })
    ).toHaveLength(2);
    fireEvent.click(
      screen.getByRole('button', { name: 'Open navigation menu' })
    );
    const menu = await screen.findByRole('dialog');
    const link = within(menu).getByRole('link', { name: 'Salary' });
    expect(link.getAttribute('href')).toBe('/dashboard/salary');
    fireEvent.click(link);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('marks dashboard only at its exact route and keeps the brand home link', () => {
    route.pathname = '/dashboard';
    const scroll = vi.fn();
    vi.stubGlobal('scrollTo', scroll);
    render(<DashboardNavbar />);
    expect(screen.getByRole('link', { name: 'Dashboard' }).className).toContain(
      'text-foreground'
    );
    fireEvent.click(screen.getByRole('link', { name: 'Fynfo' }));
    expect(scroll).toHaveBeenCalledWith({ top: 0 });
  });
});

describe('pagination controls', () => {
  it('clamps typed page numbers and ignores invalid input', () => {
    const change = vi.fn();
    render(
      <PaginationControls
        page={1}
        pageSize={10}
        total={26}
        itemLabel="record"
        onPageChange={change}
        onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByText('Showing 11–20 of 26 records')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(change).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(change).toHaveBeenLastCalledWith(2);
    const input = screen.getByLabelText('Page');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenLastCalledWith(2);
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);
    expect(change).toHaveBeenLastCalledWith(0);
    change.mockClear();
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(change).not.toHaveBeenCalled();
  });

  it('disables both directions for a single record', () => {
    render(
      <PaginationControls
        page={0}
        pageSize={10}
        total={1}
        itemLabel="record"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByText('Showing 1–1 of 1 record')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', {
          name: 'Previous page',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
