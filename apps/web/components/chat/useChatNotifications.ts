'use client';

import { api } from '@repo/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatToastData } from './ChatToast';

/** At most this many notifications on screen at once. */
const MAX_TOASTS = 3;

export interface ChatNotifications {
  /** Messages from other people since this person last read the chat. */
  unreadCount: number;
  /** True when one of those messages names them. */
  mentionsMe: boolean;
  toasts: ChatToastData[];
  dismissToast: (id: string) => void;
  /** Clears the badge and the toasts. Call when the chat is on screen. */
  markRead: () => void;
}

/**
 * The unread badge and the new-message notifications.
 *
 * Lives on the editor page rather than inside the chat panel, because both
 * things exist precisely for the times when the panel is *shut* — a badge
 * rendered by the component it is meant to draw attention to would never
 * appear.
 *
 * `isChatVisible` is what tells the two apart from ordinary reading: while the
 * chat is open, arriving messages are marked read as they land and raise no
 * notification, because the person is already looking at them.
 */
export function useChatNotifications(
  documentId: string,
  isChatVisible: boolean
): ChatNotifications {
  const unread = useQuery(api.chats.chatUnread, { documentId });
  const markChatRead = useMutation(api.chats.markChatRead);

  const [toasts, setToasts] = useState<ChatToastData[]>([]);

  /**
   * The newest message already accounted for.
   *
   * Without it, every re-render of a reactive query that happens to return the
   * same newest message — someone reacting, someone else reading — would raise
   * the same notification again. Never reset: message ids are unique, so a
   * value kept forever can only ever suppress a repeat of itself.
   */
  const announcedRef = useRef<string | null>(null);

  /**
   * Whether the first result has arrived.
   *
   * A conversation left unread since yesterday arrives in that first result,
   * and announcing its newest message would claim something just happened.
   * The backlog belongs to the badge; the toast is for what turns up while
   * somebody is watching.
   */
  const loadedRef = useRef(false);

  const markRead = useCallback(() => {
    setToasts([]);
    void markChatRead({ documentId });
  }, [markChatRead, documentId]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    // `undefined` is the query still loading, which is not the same as a
    // conversation with nothing unread in it.
    if (unread === undefined) return;

    const isInitialResult = !loadedRef.current;
    loadedRef.current = true;

    const latest = unread.latest;
    if (!latest || announcedRef.current === latest.id) return;
    announcedRef.current = latest.id;

    // Already looking at the chat: the message has been read by being seen.
    if (isChatVisible) {
      void markChatRead({ documentId });
      return;
    }
    if (isInitialResult) return;

    setToasts((current) =>
      [
        ...current.filter((toast) => toast.id !== latest.id),
        {
          id: latest.id,
          senderName: latest.senderName,
          senderAvatar: latest.senderAvatar,
          preview: latest.preview,
          mentionsMe: unread.mentionsMe,
        },
      ].slice(-MAX_TOASTS)
    );
  }, [unread, isChatVisible, markChatRead, documentId]);

  // Opening the chat is reading it. Messages that arrive while it is already
  // open are handled above, as they land.
  useEffect(() => {
    if (!isChatVisible) return;
    setToasts([]);
    void markChatRead({ documentId });
  }, [isChatVisible, markChatRead, documentId]);

  return {
    unreadCount: unread?.count ?? 0,
    mentionsMe: unread?.mentionsMe ?? false,
    toasts,
    dismissToast,
    markRead,
  };
}
