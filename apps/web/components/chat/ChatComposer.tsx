'use client';

import {
  ATTACHMENT_ACCEPT,
  checkAttachment,
  formatBytes,
  formatDuration,
  MAX_ATTACHMENTS_PER_MESSAGE,
} from '@repo/convex/chat/attachments';
import {
  findMentionedIds,
  type MentionCandidate,
  mentionQueryAt,
} from '@repo/convex/chat/mentions';
import { Loader2, Mic, Paperclip, Send, Square, X } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useVoiceRecorder } from '../../lib/useVoiceRecorder';

/** A file chosen but not yet sent. */
interface PendingAttachment {
  id: string;
  file: File;
  kind: 'file' | 'image' | 'voice';
  durationSec?: number;
}

export interface OutgoingAttachment {
  storageId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'file' | 'image' | 'voice';
  durationSec?: number;
}

export interface ChatComposerProps {
  collaborators: readonly MentionCandidate[];
  /** Uploads one file and resolves with its storage id. */
  uploadFile: (file: File) => Promise<string>;
  onSend: (message: {
    text: string;
    mentions: string[];
    attachments: OutgoingAttachment[];
  }) => Promise<void>;
  /** The message being replied to, if any, so the composer can show and clear it. */
  replyingTo?: { id: string; senderName: string; preview: string } | null;
  onCancelReply?: () => void;
}

export function ChatComposer({
  collaborators,
  uploadFile,
  onSend,
  replyingTo,
  onCancelReply,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Where the mention picker is anchored, and what it is filtering on. */
  const [mention, setMention] = useState<{ query: string; from: number; to: number } | null>(null);
  const [highlighted, setHighlighted] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();

  const matches = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return collaborators.filter((person) => person.name.toLowerCase().includes(query)).slice(0, 6);
  }, [mention, collaborators]);

  const updateMentionState = useCallback((value: string, caret: number) => {
    const found = mentionQueryAt(value, caret);
    setMention(found);
    setHighlighted(0);
  }, []);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    updateMentionState(event.target.value, event.target.selectionStart ?? 0);
  };

  /** Replaces the partial "@ada" the caret sits in with the chosen name. */
  const applyMention = useCallback(
    (person: MentionCandidate) => {
      if (!mention) return;
      const next = `${text.slice(0, mention.from)}@${person.name} ${text.slice(mention.to)}`;
      setText(next);
      setMention(null);

      // The caret has to land after the name, or the next keystroke reopens
      // the picker on a mention that has already been made.
      const caret = mention.from + person.name.length + 2;
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(caret, caret);
      });
    },
    [mention, text]
  );

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);

    const accepted: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (pending.length + accepted.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
        setError(`At most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`);
        break;
      }
      // Checked here so the sender is told now, rather than after waiting
      // through an upload the server was always going to refuse.
      const verdict = checkAttachment(file.name, file.type, file.size);
      if (!verdict.ok) {
        setError(verdict.reason);
        continue;
      }
      accepted.push({
        id: `${file.name}:${file.size}:${crypto.randomUUID()}`,
        file,
        kind: verdict.type.kind,
      });
    }

    if (accepted.length) setPending((current) => [...current, ...accepted]);
  };

  const stopRecording = async () => {
    const clip = await recorder.stop();
    if (!clip) return;

    const extension = clip.mimeType.includes('mp4') ? 'm4a' : 'webm';
    setPending((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        file: new File([clip.blob], `voice-message.${extension}`, { type: clip.mimeType }),
        kind: 'voice',
        durationSec: clip.durationSec,
      },
    ]);
  };

  const canSend = (text.trim().length > 0 || pending.length > 0) && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);

    try {
      const attachments: OutgoingAttachment[] = [];
      for (const item of pending) {
        const storageId = await uploadFile(item.file);
        attachments.push({
          storageId,
          name: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
          kind: item.kind,
          durationSec: item.durationSec,
        });
      }

      await onSend({
        text: text.trim(),
        mentions: findMentionedIds(text, collaborators),
        attachments,
      });

      setText('');
      setPending([]);
      setMention(null);
      onCancelReply?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // While the picker is open the arrow keys belong to it, not to the caret.
    if (mention && matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlighted((index) => (index + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted((index) => (index - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const person = matches[highlighted];
        if (person) applyMention(person);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setMention(null);
        return;
      }
    }

    // Enter sends; Shift+Enter is how you get a second line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const recording = recorder.state === 'recording' || recorder.state === 'requesting';

  return (
    <div className="border-t border-border/80 bg-muted/20">
      {replyingTo && (
        <div className="flex items-start gap-2 border-b border-border/60 px-3 py-1.5">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <p className="text-[10px] font-bold text-primary">
              Replying to {replyingTo.senderName}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">{replyingTo.preview}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="mt-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pt-2">
          {pending.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[10px]"
            >
              <span className="max-w-[9rem] truncate font-medium">
                {item.kind === 'voice' && item.durationSec !== undefined
                  ? `Voice message · ${formatDuration(item.durationSec)}`
                  : item.file.name}
              </span>
              <span className="text-muted-foreground">{formatBytes(item.file.size)}</span>
              <button
                type="button"
                onClick={() => setPending((current) => current.filter((p) => p.id !== item.id))}
                aria-label={`Remove ${item.file.name}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(error || recorder.error) && (
        <p className="px-3 pt-2 text-[10px] font-medium text-destructive">
          {error ?? recorder.error}
        </p>
      )}

      <div className="relative p-3">
        {mention && matches.length > 0 && (
          <ul className="absolute bottom-full left-3 z-20 mb-1 w-56 overflow-hidden rounded-lg border border-border bg-background shadow-md">
            {matches.map((person, index) => (
              <li key={person.id}>
                <button
                  type="button"
                  // The picker must not steal focus from the textarea, or the
                  // caret position the replacement depends on is lost.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    applyMention(person);
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs ${
                    index === highlighted ? 'bg-muted' : ''
                  }`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                    {person.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate">{person.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            onChange={(event) => {
              addFiles(event.target.files);
              // Cleared so picking the same file twice in a row still fires.
              event.target.value = '';
            }}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={sending || recording}
            title="Attach a file"
            aria-label="Attach a file"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => (recording ? void stopRecording() : void recorder.start())}
            disabled={sending}
            title={recording ? 'Stop recording' : 'Record a voice message'}
            aria-label={recording ? 'Stop recording' : 'Record a voice message'}
            className={`shrink-0 rounded-lg p-1.5 transition-colors disabled:opacity-40 ${
              recording
                ? 'bg-destructive/10 text-destructive'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {recorder.state === 'requesting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          {recording ? (
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-destructive/40 bg-background px-3 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-xs font-medium tabular-nums">
                {formatDuration(recorder.seconds)}
              </span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={recorder.cancel}
                className="text-[10px] font-semibold text-muted-foreground hover:text-destructive"
              >
                Discard
              </button>
            </div>
          ) : (
            <textarea
              ref={inputRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onClick={(event) => updateMentionState(text, event.currentTarget.selectionStart ?? 0)}
              rows={1}
              placeholder="Type a message, @ to mention…"
              className="max-h-24 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
            />
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            title="Send"
            aria-label="Send message"
            className="shrink-0 rounded-lg bg-primary p-1.5 text-primary-foreground shadow-xs transition-all hover:bg-primary/95 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
