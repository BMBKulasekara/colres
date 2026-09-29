import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { placeholderKeys } from '../../lib/placeholders';

/**
 * A skeleton of the console shell rather than a spinner, so the page doesn't
 * jump when the real layout arrives.
 */
export function GuardLoading() {
  return (
    <div className="flex min-h-dvh bg-background" aria-busy="true" aria-live="polite">
      <span className="sr-only">Checking your access…</span>
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-r bg-sidebar p-3 md:flex">
        <Skeleton className="mb-4 h-8 w-32" />
        {placeholderKeys(7, 'i').map((i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex h-12 items-center gap-3 border-b px-6">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {placeholderKeys(4, 'i').map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
          <Skeleton className="h-64 sm:col-span-2 xl:col-span-4" />
        </div>
      </div>
    </div>
  );
}
