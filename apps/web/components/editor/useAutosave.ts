'use client';

import { useStatus, useSyncStatus } from '@liveblocks/react/suspense';
import { useCallback, useEffect, useRef, useState } from 'react';

/** How long typing has to pause before the snapshot is written. */
const SAVE_DEBOUNCE_MS = 1500;
/** Attempts per save before the author is told it failed. */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;

export type SaveState = 'saved' | 'saving' | 'offline' | 'error';

export interface DocumentPatch {
  title?: string;
  content?: string;
}

/**
 * Autosave, replacing the manual Save button.
 *
 * The document's text lives in Liveblocks and is synced as it is typed; what
 * Convex holds is a snapshot of it, used for the library, search and the
 * first paint of a new session. So "saved" has two halves, and this reports
 * both honestly:
 *
 *  - Liveblocks has every local change (`useSyncStatus`), and the room is
 *    connected (`useStatus`). Disconnected means offline: edits are kept
 *    locally and sent when the connection returns.
 *  - The Convex snapshot has been written: debounced after typing stops, and
 *    retried a few times before giving up with an error the author can act on.
 */
export function useAutosave(save: (patch: DocumentPatch) => Promise<unknown>) {
  const connection = useStatus();
  const liveblocksSync = useSyncStatus({ smooth: true });

  const [snapshotState, setSnapshotState] = useState<'idle' | 'pending' | 'saving' | 'error'>(
    'idle'
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const pendingRef = useRef<DocumentPatch>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    clearTimer();
    if (inFlightRef.current) {
      // The running save picks up anything queued meanwhile when it finishes.
      return;
    }

    const patch = pendingRef.current;
    if (patch.title === undefined && patch.content === undefined) return;
    pendingRef.current = {};

    inFlightRef.current = true;
    setSnapshotState('saving');

    let saved = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !saved; attempt++) {
      try {
        await saveRef.current(patch);
        saved = true;
      } catch (error) {
        console.error(`Autosave attempt ${attempt} failed:`, error);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * 2 ** (attempt - 1)));
        }
      }
    }
    inFlightRef.current = false;

    if (!saved) {
      // Put the failed patch back under anything typed since, so a retry
      // sends the newest text without losing a title change from before.
      pendingRef.current = { ...patch, ...pendingRef.current };
      setSnapshotState('error');
      return;
    }

    setLastSavedAt(Date.now());
    const queued = pendingRef.current;
    if (queued.title !== undefined || queued.content !== undefined) {
      setSnapshotState('pending');
      timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    } else {
      setSnapshotState('idle');
    }
  }, [clearTimer]);

  /** Queues a change and restarts the debounce. */
  const schedule = useCallback(
    (patch: DocumentPatch) => {
      pendingRef.current = { ...pendingRef.current, ...patch };
      setSnapshotState((state) => (state === 'saving' ? state : 'pending'));
      clearTimer();
      timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
    },
    [flush, clearTimer]
  );

  // Whatever is queued is written on the way out of the page.
  useEffect(
    () => () => {
      clearTimer();
      void flush();
    },
    [flush, clearTimer]
  );

  const isOffline = connection === 'disconnected' || connection === 'reconnecting';

  let state: SaveState;
  if (snapshotState === 'error') state = 'error';
  else if (isOffline) state = 'offline';
  else if (snapshotState !== 'idle' || liveblocksSync === 'synchronizing') state = 'saving';
  else state = 'saved';

  return { state, lastSavedAt, schedule, flush };
}
