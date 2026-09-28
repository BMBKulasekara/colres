'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the id of whichever of `ids` currently sits in the band just below
 * the sticky nav, or null when none does (e.g. at the top of the page).
 */
export function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        setActive(ids.find((id) => visible.has(id)) ?? null);
      },
      // A thin band 30–40% down the viewport: the section crossing it is "current".
      { rootMargin: '-30% 0px -60% 0px' }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
