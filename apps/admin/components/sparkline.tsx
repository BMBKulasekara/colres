/** A tiny trend line. Decorative: the value it summarises is always shown as text beside it. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 28;
  const step = width / (values.length - 1);
  const points = values.map(
    (v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * (height - 2) - 1).toFixed(2)}`
  );
  const line = `M${points.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <path d={area} className="fill-primary/10" />
      <path
        d={line}
        className="fill-none stroke-primary"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
