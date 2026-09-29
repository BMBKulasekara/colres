'use client';

import { useEffect, useRef } from 'react';

/** True when focus is somewhere a keystroke means typing, not a command. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/**
 * Binds a keyboard shortcut. `combo` is a key with optional "mod+" (⌘ on
 * macOS, Ctrl elsewhere), e.g. "mod+k" or "mod+s". Shortcuts with "mod" fire
 * even inside inputs; bare keys do not.
 */
export function useHotkey(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean } = {}
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const enabled = options.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const needsMod = parts.includes('mod');
    const needsShift = parts.includes('shift');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return;
      const mod = event.metaKey || event.ctrlKey;
      if (needsMod !== mod || needsShift !== event.shiftKey || event.altKey) return;
      if (!needsMod && isTypingTarget(event.target)) return;
      event.preventDefault();
      handlerRef.current(event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled]);
}
