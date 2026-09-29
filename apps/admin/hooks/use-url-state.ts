'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

type Patch = Record<string, string | number | boolean | null | undefined>;

/**
 * Filters, search, tabs and the open record live in the URL, so a view can be
 * shared, bookmarked, reloaded, and walked back with the browser's Back button.
 *
 * Empty values are removed rather than written as `?q=`.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback((key: string) => searchParams.get(key) ?? undefined, [searchParams]);

  const set = useCallback(
    (patch: Patch, options: { push?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '' || value === false) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const query = next.toString();
      const url = query ? `${pathname}?${query}` : pathname;
      if (options.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return useMemo(() => ({ get, set, searchParams }), [get, set, searchParams]);
}
