import { useEffect, useState } from 'react';

/**
 * Whether a media query matches. False on the server and on the first client
 * render, so the markup the two produce agrees; the real answer arrives in the
 * effect.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}
