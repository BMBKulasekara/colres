'use client';

import { MessageSquare, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

/** How long a notification stays up before it fades on its own. */
const DISMISS_AFTER_MS = 6000;

export interface ChatToastData {
  id: string;
  senderName: string;
  senderAvatar: string;
  preview: string;
  /** True when the message names you, which is worth a louder treatment. */
  mentionsMe: boolean;
}

/**
 * The in-app notification for a new chat message.
 *
 * Deliberately not the browser's Notification API. That needs a permission
 * prompt, and a prompt that appears because somebody said hello — before the
 * person has any idea what they would be agreeing to — is the kind of thing
 * people deny once and then cannot easily undo. An in-app toast needs no
 * permission, works the moment the feature ships, and is visible exactly where
 * the person is already looking.
 *
 * Clicking it opens the chat, because a notification that cannot be acted on
 * is just an interruption.
 */
function Toast({
  toast,
  onOpen,
  onDismiss,
}: {
  toast: ChatToastData;
  onOpen: () => void;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), DISMISS_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex w-72 items-start gap-2.5 rounded-xl border bg-background p-3 shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200 ${
        toast.mentionsMe ? 'border-primary' : 'border-border'
      }`}
    >
      {toast.senderAvatar ? (
        <Image
          src={toast.senderAvatar}
          alt={toast.senderName}
          width={100}
          height={100}
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {toast.senderName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="flex items-center gap-1 text-[11px] font-bold text-foreground">
          {toast.senderName}
          {toast.mentionsMe && (
            <span className="rounded bg-primary/10 px-1 text-[9px] font-bold text-primary">
              mentioned you
            </span>
          )}
        </p>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {toast.preview}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-primary">
          <MessageSquare className="h-2.5 w-2.5" />
          Open team chat
        </p>
      </button>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * The stack of notifications, bottom-right.
 *
 * `pointer-events-none` on the container with `pointer-events-auto` on each
 * toast is what keeps the empty space beside them clickable — otherwise an
 * invisible pane would sit over the corner of the document.
 */
export function ChatToasts({
  toasts,
  onOpen,
  onDismiss,
}: {
  toasts: readonly ChatToastData[];
  onOpen: () => void;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onOpen={onOpen} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
