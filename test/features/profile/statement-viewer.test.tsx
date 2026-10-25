// @vitest-environment jsdom
import { StatementViewer } from '@/features/import-review/components/statement-viewer';
import { stepStatementZoom } from '@/features/import-review/lib/statement-zoom';
import type { StatementCandidate } from '@/features/import-review/types';
import { AmountVisibilityProvider } from '@/features/privacy';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const pdf = vi.hoisted(() => ({ render: vi.fn(), destroy: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  pdf.render.mockResolvedValue(null);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const chosen = {
  id: 'row',
  source: [
    { page: 1, line: 4, text: '01 OCT MARKET 12.30' },
    { page: 1, line: 5, text: 'REF 123' },
  ],
} as StatementCandidate;
function mount(onError = vi.fn()) {
  render(
    <AmountVisibilityProvider>
      <StatementViewer
        pdf={{ pageCount: 2, extract: vi.fn(), ...pdf }}
        page={1}
        pageCount={2}
        visible
        chosen={chosen}
        onPageChange={vi.fn()}
        onError={onError}
      />
    </AmountVisibilityProvider>
  );
  return screen.getByRole('region', { name: /Statement page 1/ });
}
const lastOptions = () => pdf.render.mock.calls.at(-1)?.[2];

it('steps zoom levels within bounds', () => {
  expect(stepStatementZoom('fit', -1)).toBe('fit');
  expect(stepStatementZoom('fit', 1)).toBe('100');
  expect(stepStatementZoom('300', 1)).toBe('300');
});

it('renders the selected source lines at the container width and re-renders sharper when zoomed', async () => {
  mount();
  await waitFor(() =>
    expect(pdf.render).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), {
      width: 400,
      highlight: [4, 5],
    })
  );
  expect(screen.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
  expect(screen.getByText('150%')).toBeInTheDocument();
  await waitFor(() => expect(lastOptions()).toMatchObject({ width: 600 }));
  expect(document.querySelector('canvas')).toHaveClass('w-[150%]');
  fireEvent.click(screen.getByRole('button', { name: 'Fit' }));
  expect(screen.getByRole('region', { name: /at Fit./ })).toBeInTheDocument();
  expect(document.querySelector('canvas')).toHaveClass('object-contain');
});

it('zooms with keys and Ctrl+wheel and pans by dragging the scroll position', async () => {
  const region = mount();
  fireEvent.keyDown(region, { key: '+' });
  fireEvent.keyDown(region, { key: '=' });
  expect(screen.getByText('150%')).toBeInTheDocument();
  fireEvent.keyDown(region, { key: '-' });
  expect(screen.getByText('100%')).toBeInTheDocument();
  fireEvent.wheel(region, { ctrlKey: true, deltaY: -100 });
  expect(screen.getByText('150%')).toBeInTheDocument();
  fireEvent.wheel(region, { deltaY: -100 });
  expect(screen.getByText('150%')).toBeInTheDocument();
  Object.defineProperty(region, 'scrollLeft', { writable: true, value: 0 });
  Object.defineProperty(region, 'scrollTop', { writable: true, value: 0 });
  fireEvent.pointerDown(region, {
    pointerId: 1,
    button: 0,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(region, { pointerId: 1, clientX: 60, clientY: 40 });
  fireEvent.pointerUp(region, { pointerId: 1 });
  expect(region.scrollLeft).toBe(40);
  expect(region.scrollTop).toBe(60);
  fireEvent.keyDown(region, { key: '0' });
  expect(screen.getByRole('region', { name: /at Fit./ })).toBeInTheDocument();
});

it('reports a failed render through the opaque error callback', async () => {
  pdf.render.mockRejectedValue(new Error('private'));
  const onError = vi.fn();
  mount(onError);
  await waitFor(() =>
    expect(onError).toHaveBeenCalledWith(
      'This source page could not be rendered. Choose another file or clear the review.'
    )
  );
});
