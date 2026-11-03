// @vitest-environment jsdom
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
} from '@/lib/recharts';
import { act, cleanup, render } from '@testing-library/react';
import { ResponsiveContainer as RawResponsiveContainer } from 'recharts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DATA = [
  { name: 'a', value: 1 },
  { name: 'b', value: 2 },
];

let size = { width: 0, height: 0 };
const disconnectSpy = vi.fn();
let observers: Array<(entries: unknown[]) => void> = [];

// jsdom has no layout, so measurements and ResizeObserver are driven by hand.
beforeEach(() => {
  size = { width: 0, height: 0 };
  observers = [];
  disconnectSpy.mockClear();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({ ...size, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0 }) as DOMRect
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: (entries: unknown[]) => void) {
        observers.push(cb);
      }
      observe() {}
      disconnect() {
        disconnectSpy();
      }
    }
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function sizeWarnings(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    String(args[0]).includes('should be greater than 0')
  );
}

function resizeTo(width: number, height: number) {
  size = { width, height };
  act(() => {
    observers.forEach((cb) => cb([{ contentRect: size }]));
  });
}

function Chart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={DATA}>
        <XAxis dataKey="name" />
        <Bar dataKey="value">
          {DATA.map((d) => (
            <Cell key={d.name} fill="red" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

describe('chart ResponsiveContainer', () => {
  it('control: recharts default container warns on first render', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <RawResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA}>
          <Bar dataKey="value" />
        </BarChart>
      </RawResponsiveContainer>
    );
    expect(sizeWarnings(spy).length).toBeGreaterThan(0);
  });

  it('mounts the chart without a warning when the parent has a size', () => {
    size = { width: 400, height: 300 };
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <div className="h-80">
        <Chart />
      </div>
    );
    expect(container.querySelector('.recharts-responsive-container')).not.toBe(
      null
    );
    expect(sizeWarnings(spy)).toHaveLength(0);
  });

  it('does not mount or warn while a hidden parent measures 0x0, then mounts on reveal', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(
      <div className="hidden">
        <Chart />
      </div>
    );
    expect(container.querySelector('.recharts-responsive-container')).toBe(
      null
    );
    expect(sizeWarnings(spy)).toHaveLength(0);

    resizeTo(400, 300);
    expect(container.querySelector('.recharts-responsive-container')).not.toBe(
      null
    );
    expect(sizeWarnings(spy)).toHaveLength(0);
  });

  it('stays warning-free across resize and re-hide after mount', () => {
    size = { width: 400, height: 300 };
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Chart />);

    resizeTo(640, 300);
    expect(container.querySelector('.recharts-responsive-container')).not.toBe(
      null
    );

    resizeTo(0, 0);
    expect(container.querySelector('.recharts-responsive-container')).toBe(
      null
    );

    resizeTo(500, 280);
    expect(container.querySelector('.recharts-responsive-container')).not.toBe(
      null
    );
    expect(sizeWarnings(spy)).toHaveLength(0);
  });

  it('disconnects its ResizeObserver on unmount', () => {
    size = { width: 400, height: 300 };
    const { unmount } = render(<Chart />);
    expect(disconnectSpy).not.toHaveBeenCalled();
    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('lets a caller override initialDimension', () => {
    size = { width: 400, height: 300 };
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: -1, height: -1 }}
      >
        <BarChart data={DATA}>
          <Bar dataKey="value" />
        </BarChart>
      </ResponsiveContainer>
    );
    expect(sizeWarnings(spy).length).toBeGreaterThan(0);
  });
});
