'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const THEME_STORAGE_KEY = 'colres:theme';
const THEME_CHANGE_EVENT = 'colres:theme';

/**
 * Applies the stored theme, and keeps applying it for the life of the page.
 *
 * Runs inline in the document head, before anything is painted, so a dark
 * theme never flashes light first. It owns the `dark` class outright: the hook
 * below only stores the preference and asks this to look again, which is what
 * keeps the operating system's setting followed live under "System".
 */
export const THEME_INIT_SCRIPT = `(function(){var k='${THEME_STORAGE_KEY}';var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==='dark'||(p!=='light'&&m.matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}a();m.addEventListener('change',a);window.addEventListener('storage',a);window.addEventListener('${THEME_CHANGE_EVENT}',a)})()`;

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** The theme preference, remembered per browser. */
export function useTheme(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribe,
    readPreference,
    () => 'system'
  );

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Without storage the choice cannot be kept, so there is nothing to apply.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  return [preference, setPreference];
}
