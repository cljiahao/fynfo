// @vitest-environment jsdom
import {
  CHART_AXIS_TICK_PROPS,
  CHART_TOOLTIP_PROPS,
  Cell,
} from '@/lib/recharts';
import { Cell as RealCell } from 'recharts';
import { describe, expect, it } from 'vitest';

// Regression guard for spec 027. recharts colors per-bar via <Cell> children and
// matches them with findAllByType, which compares component displayName. A
// next/dynamic wrapper has displayName 'LoadableComponent', so wrapping Cell in
// dynamic() silently drops every per-bar fill. Cell MUST stay a static re-export.
describe('@/lib/recharts Cell export', () => {
  it('is recharts real Cell, not a dynamic wrapper', () => {
    expect(Cell).toBe(RealCell);
  });

  it("has displayName 'Cell' so findAllByType matches it", () => {
    const name =
      (Cell as { displayName?: string; name?: string }).displayName ??
      (Cell as { name?: string }).name;
    expect(name).toBe('Cell');
  });
});

describe('CHART_AXIS_TICK_PROPS', () => {
  it('drives axis tick text from the theme foreground token', () => {
    expect(CHART_AXIS_TICK_PROPS.className).toContain('fill-foreground');
    expect(CHART_AXIS_TICK_PROPS.tick.fill).toBe('currentColor');
  });
});

// Spec 028. recharts' default Tooltip is a hard-coded white box with near-black
// label text — illegible in dark mode. The shared prop bag must drive both the
// surface and the label from Tailwind theme vars so it tracks light/dark.
describe('CHART_TOOLTIP_PROPS', () => {
  it('themes the tooltip surface from theme vars', () => {
    expect(CHART_TOOLTIP_PROPS.contentStyle.backgroundColor).toBe(
      'var(--background)'
    );
    expect(CHART_TOOLTIP_PROPS.contentStyle.color).toBe('var(--foreground)');
  });

  it('themes the tooltip label from the foreground token', () => {
    expect(CHART_TOOLTIP_PROPS.labelStyle.color).toBe('var(--foreground)');
  });
});
