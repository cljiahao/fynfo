// @vitest-environment jsdom
import { CallersList } from '@/features/investment-api/components/callers-list';
import type {
  CallerKey,
  CallerSummary,
} from '@/features/investment-api/schemas/callers-schemas';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/investment-api/actions/callers-actions', () => ({
  listCallers: vi.fn(),
  createCallerAction: vi.fn(),
  addKeyAction: vi.fn(),
  revokeKeyAction: vi.fn(),
  revokeCallerAction: vi.fn(),
  setSealingKeyAction: vi.fn(),
}));

const NOW = new Date('2026-06-01T00:00:00Z').getTime();
const DAY = 86_400_000;

function key(id: string, daysFromNow: number, revoked = false): CallerKey {
  return {
    id,
    createdAt: '2026-05-01T00:00:00Z',
    expiresAt: new Date(NOW + daysFromNow * DAY).toISOString(),
    revokedAt: revoked ? '2026-05-20T00:00:00Z' : null,
  };
}

function caller(keys: CallerKey[], over: Partial<CallerSummary> = {}) {
  return {
    id: 'caller-1',
    name: 'ballast',
    preset: 'ballast',
    scopes: ['summary:read', 'journal:append:plan'],
    sealingFingerprint: 'abcd1234',
    createdAt: '2026-05-01T00:00:00Z',
    revokedAt: null,
    keys,
    ...over,
  } satisfies CallerSummary;
}

function renderList(callers: CallerSummary[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CallersList callers={callers} now={NOW} />
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe('CallersList', () => {
  it('renders name, preset, scopes, fingerprint and key details', () => {
    renderList([caller([key('key-aaa', 60)])]);
    expect(screen.getAllByText('ballast')).toHaveLength(2);
    expect(screen.getAllByText(/summary:read/).length).toBeGreaterThan(0);
    expect(screen.getByText('abcd1234')).toBeInTheDocument();
    expect(screen.getByText('key-aaa')).toBeInTheDocument();
    expect(screen.getByText(/60 days left/)).toBeInTheDocument();
    expect(screen.queryByText(/Expiring soon/)).not.toBeInTheDocument();
  });

  it('warns when a key expires in under 14 days', () => {
    renderList([caller([key('key-aaa', 5)])]);
    expect(screen.getByText(/5 days left/)).toBeInTheDocument();
    expect(screen.getByText(/Expiring soon/)).toBeInTheDocument();
  });

  it('shows revoked state for keys and callers', () => {
    renderList([
      caller([key('key-aaa', 60, true)], { revokedAt: '2026-05-25T00:00:00Z' }),
    ]);
    expect(screen.getAllByText(/Revoked/).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: 'Revoke caller' })
    ).not.toBeInTheDocument();
  });

  it('keeps add key enabled with one active key', () => {
    renderList([caller([key('k1', 60), key('k2', 60, true)])]);
    expect(screen.getByRole('button', { name: 'Add key' })).toBeEnabled();
  });

  it('disables add key when two keys are active', () => {
    renderList([caller([key('k1', 60), key('k2', 80)])]);
    expect(screen.getByRole('button', { name: 'Add key' })).toBeDisabled();
  });

  it('copies the key ID', () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderList([caller([key('key-aaa', 60)])]);
    fireEvent.click(screen.getByRole('button', { name: 'Copy key ID' }));
    expect(writeText).toHaveBeenCalledWith('key-aaa');
  });

  it('asks for confirmation before revoking a caller', () => {
    renderList([caller([key('k1', 60)])]);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke caller' }));
    expect(screen.getByText(/cannot be undone/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
