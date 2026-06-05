import dynamic from 'next/dynamic';

// Cell is a pure config marker (renders nothing on its own, no browser APIs) and
// only mounts inside the ssr:false Bar/Pie. It MUST be a static re-export, not a
// next/dynamic wrapper: recharts matches Cell children by displayName via
// findAllByType, and a dynamic wrapper's displayName ('LoadableComponent') never
// matches 'Cell', silently dropping per-bar colors. See spec 027.
export { Cell } from 'recharts';

// Theme-aware axis tick text. Spread onto XAxis/YAxis so tick labels use the
// Tailwind --foreground token (fill is an inherited SVG property) instead of
// recharts' default #666, keeping them legible in dark mode. See spec 027.
export const CHART_AXIS_TICK_PROPS = {
  className: 'fill-foreground',
  tick: { fill: 'currentColor' },
} as const;

export const Bar = dynamic(() => import('recharts').then((m) => m.Bar), {
  ssr: false,
});
export const BarChart = dynamic(
  () => import('recharts').then((m) => m.BarChart),
  { ssr: false }
);
export const LabelList = dynamic(
  () => import('recharts').then((m) => m.LabelList),
  { ssr: false }
);
export const Legend = dynamic(() => import('recharts').then((m) => m.Legend), {
  ssr: false,
});
export const Line = dynamic(() => import('recharts').then((m) => m.Line), {
  ssr: false,
});
export const LineChart = dynamic(
  () => import('recharts').then((m) => m.LineChart),
  { ssr: false }
);
export const Pie = dynamic(() => import('recharts').then((m) => m.Pie), {
  ssr: false,
});
export const PieChart = dynamic(
  () => import('recharts').then((m) => m.PieChart),
  { ssr: false }
);
export const ReferenceLine = dynamic(
  () => import('recharts').then((m) => m.ReferenceLine),
  { ssr: false }
);
export const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false }
);
export const Tooltip = dynamic(
  () => import('recharts').then((m) => m.Tooltip),
  { ssr: false }
);
export const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), {
  ssr: false,
});
export const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), {
  ssr: false,
});
