// @vitest-environment jsdom
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
} from '@/lib/recharts';
import { cleanup, render } from '@testing-library/react';
import { ResponsiveContainer as RawResponsiveContainer } from 'recharts';
import { afterEach, describe, expect, it, vi } from 'vitest';

const DATA = [
  { name: 'a', value: 1 },
  { name: 'b', value: 2 },
];

function sizeWarnings(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    String(args[0]).includes('should be greater than 0')
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it('lib wrapper mounts without a width/height warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <div className="h-80">
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
      </div>
    );
    expect(sizeWarnings(spy)).toHaveLength(0);
  });

  it('lets a caller override initialDimension', () => {
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
