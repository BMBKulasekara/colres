/** The "C" logo tile, shared by the app sidebar and the editor header. */
export function ColresMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-8 shrink-0 place-items-center rounded-md bg-linear-to-br from-primary to-brand-teal text-sm font-bold text-white ${className}`}
    >
      C
    </span>
  );
}
