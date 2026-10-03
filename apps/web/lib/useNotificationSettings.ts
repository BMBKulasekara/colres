'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** The side panels whose rail badge can be switched off. */
export type NotificationId = 'research' | 'references' | 'comments' | 'chat';

export type NotificationSettings = Record<NotificationId, boolean>;

export const NOTIFICATION_OPTIONS: { id: NotificationId; label: string }[] = [
  { id: 'research', label: 'Research' },
  { id: 'references', label: 'References' },
  { id: 'comments', label: 'Comments' },
  { id: 'chat', label: 'Team chat' },
];

const STORAGE_KEY = 'colres:editor:notifications';
const CHANGE_EVENT = 'colres:notifications';

const ALL_ON: NotificationSettings = {
  research: true,
  references: true,
  comments: true,
  chat: true,
};

// useSyncExternalStore needs the same object back for the same stored value.
let cachedRaw: string | null = null;
let cachedSettings = ALL_ON;

function readSettings(): NotificationSettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return ALL_ON;
  }
  if (raw === cachedRaw) return cachedSettings;

  cachedRaw = raw;
  try {
    const stored = raw ? (JSON.parse(raw) as Partial<NotificationSettings>) : {};
    cachedSettings = { ...ALL_ON };
    for (const { id } of NOTIFICATION_OPTIONS) {
      if (stored[id] === false) cachedSettings[id] = false;
    }
  } catch {
    cachedSettings = ALL_ON;
  }
  return cachedSettings;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Which rail badges this person wants to see, remembered per browser. */
export function useNotificationSettings(): [
  NotificationSettings,
  (id: NotificationId, enabled: boolean) => void,
] {
  const settings = useSyncExternalStore(subscribe, readSettings, () => ALL_ON);

  const setEnabled = useCallback((id: NotificationId, enabled: boolean) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...readSettings(), [id]: enabled })
      );
    } catch {
      // Not being able to remember the preference is not worth failing over.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [settings, setEnabled];
}
