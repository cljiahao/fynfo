import { createElement } from 'react';
import {
  ResponsiveContainer as RechartsResponsiveContainer,
  type ResponsiveContainerProps,
} from 'recharts';

// Primitives are re-exported statically. The recharts bundle stays out of the
// initial JS by lazy-loading each whole chart component (see the *-chart.tsx
// wrappers), not the individual primitives: per-primitive next/dynamic made each
// piece resolve on its own, so ResponsiveContainer measured before its children
// existed and the chart re-rendered once per resolved child. It also breaks
// recharts' displayName matching (findAllByType), e.g. Cell children inside Bar
// would be silently dropped because a dynamic wrapper's displayName is
// 'LoadableComponent'.
export {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// recharts' default initialDimension is -1x-1, and ResponsiveContainer warns
// ("width(-1) and height(-1) of chart should be greater than 0") on that first
// render before its effect measures the real size. A positive placeholder
// silences it; the measured size replaces it immediately after mount.
const CHART_INITIAL_DIMENSION = { width: 1, height: 1 } as const;

export function ResponsiveContainer(props: ResponsiveContainerProps) {
  return createElement(RechartsResponsiveContainer, {
    initialDimension: CHART_INITIAL_DIMENSION,
    ...props,
  });
}

// Theme-aware axis tick text. Spread onto XAxis/YAxis so tick labels use the
// Tailwind --foreground token (fill is an inherited SVG property) instead of
// recharts' default #666, keeping them legible in dark mode.
export const CHART_AXIS_TICK_PROPS = {
  className: 'fill-foreground',
  tick: { fill: 'currentColor' },
} as const;

// Theme-aware tooltip surface for charts that use recharts' default Tooltip
// (no custom content). recharts' default popup is a hard-coded white box with
// near-black label text — illegible/jarring in dark mode. Driving the surface
// and label from Tailwind theme vars makes it track light/dark. itemStyle is
// left untouched so each series keeps its own color.
export const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: 'var(--background)',
    border: '1px solid var(--border)',
    borderRadius: '0.5rem',
    color: 'var(--foreground)',
  },
  labelStyle: { color: 'var(--foreground)', fontWeight: 600 },
} as const;
