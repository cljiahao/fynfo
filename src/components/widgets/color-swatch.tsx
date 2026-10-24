interface ColorSwatchProps {
  /** Any CSS colour, normally a `chartColor()` token reference. */
  color: string;
  className?: string;
}

/** Legend dot. Drawn as SVG so the data-driven colour needs no inline style. */
export function ColorSwatch({
  color,
  className = 'size-2.5',
}: ColorSwatchProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      className={`inline-block shrink-0 ${className}`}
    >
      <circle cx="5" cy="5" r="5" fill={color} />
    </svg>
  );
}
