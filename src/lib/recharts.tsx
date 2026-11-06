'use client';

import { useLayoutEffect, useState } from 'react';
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
  ComposedChart,
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

// recharts warns ("width(..) and height(..) of chart should be greater than 0")
// whenever its container measures <= 0, and its default initialDimension is
// -1x-1, so even a correctly styled container warns on first render. Two guards:
// a positive initialDimension covers the first render, and the chart is only
// mounted while the wrapper itself measures > 0 on both axes. minWidth/minHeight
// cannot cover the second case because a display:none ancestor (e.g. a hidden
// tab) always measures 0x0. The wrapper fills its parent, so callers keep
// putting a definite height on the parent (an auto-height parent would leave
// this wrapper at 0 and the chart unmounted).
const CHART_INITIAL_DIMENSION = { width: 1, height: 1 } as const;

export function ResponsiveContainer({
  children,
  ...props
}: ResponsiveContainerProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [measurable, setMeasurable] = useState(false);

  useLayoutEffect(() => {
    if (!node) return;
    const update = () => {
      const { width, height } = node.getBoundingClientRect();
      setMeasurable(width > 0 && height > 0);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return (
    <div ref={setNode} className="h-full w-full min-w-0">
      {measurable ? (
        <RechartsResponsiveContainer
          initialDimension={CHART_INITIAL_DIMENSION}
          {...props}
        >
          {children}
        </RechartsResponsiveContainer>
      ) : null}
    </div>
  );
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
