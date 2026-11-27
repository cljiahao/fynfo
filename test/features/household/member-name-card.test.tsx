// @vitest-environment jsdom
import { MemberNameCard } from '@/features/household/components/member-name-card';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  data: null as Record<string, unknown> | null | undefined,
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock('@/features/household/hooks/use-household', () => ({
  useHousehold: () => ({ data: state.data }),
  useSetMemberName: () => ({ mutate: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

it('shows the field with the current name for a household member', () => {
  state.data = { locked: false, userId: 'u1', memberNames: { u1: 'Alex' } };
  render(<MemberNameCard />);
  expect(screen.getByText('Household name')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Alex')).toBeInTheDocument();
});

it('renders nothing without a household', () => {
  state.data = null;
  const { container } = render(<MemberNameCard />);
  expect(container).toBeEmptyDOMElement();
});

it('renders nothing while the household is locked', () => {
  state.data = { locked: true, userId: 'u1', memberNames: {} };
  const { container } = render(<MemberNameCard />);
  expect(container).toBeEmptyDOMElement();
});
