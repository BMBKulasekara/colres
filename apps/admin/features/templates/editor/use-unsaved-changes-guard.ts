'use client';

import { useEffect } from 'react';

/**
 * Warns before leaving with unsaved changes: on reload/close through
 * `beforeunload`, and on in-app link clicks (the App Router has no navigation
 * blocking API, so links are intercepted in the capture phase).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey
      )
        return;
      const anchor = (event.target as HTMLElement).closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname)
        return;
      if (!window.confirm('You have unsaved changes. Leave without saving?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);
}
