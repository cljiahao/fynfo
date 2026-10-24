export type ChartSlot =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14;

/** Theme-aware categorical colour (`--cat-N` in globals.css) for SVG fills and strokes. */
export function chartColor(slot: ChartSlot): string {
  return `var(--cat-${slot})`;
}

/** Maps each key to its fixed palette slot's colour, so an entity keeps its hue. */
export function chartColors<K extends string>(
  slots: Record<K, ChartSlot>
): Record<K, string> {
  return Object.fromEntries(
    Object.entries<ChartSlot>(slots).map(([key, slot]) => [
      key,
      chartColor(slot),
    ])
  ) as Record<K, string>;
}
