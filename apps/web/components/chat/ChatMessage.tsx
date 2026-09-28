'use client';

import type { Id } from '@repo/convex/_generated/dataModel';
import { type MentionCandidate, splitMentions } from '@repo/convex/chat/mentions';
import { CornerUpLeft, SmilePlus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { AttachmentList, type ChatAttachment } from './ChatAttachments';

/** The emoji offered on the reaction button. Six fits one row in the panel. */
const QUICK_REACTIONS = ['👍', '🎉', '❤️', '👀', '🙏', '😄'];

export interface ChatMessageData {
  _id: Id<'chats'>;
  text: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  createdAt: number;
  mentions?: string[];
  mentionsMe: boolean;
  attachments: ChatAttachment[];
  reactions: { emoji: string; names: string[]; mine: boolean }[];
  quoted?: { senderName: string; preview: string } | null;
}

function Avatar({ name, src }: { name: string; src: string }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={100}
        height={100}
        className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Message text with the mentioned names picked out. */
function MessageText({
  text,
  mentioned,
  isMe,
}: {
  text: string;
  mentioned: readonly MentionCandidate[];
  isMe: boolean;
}) {
  const segments = splitMentions(text, mentioned);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <strong
            // Segments are positional and the message is re-rendered whole.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
            key={index}
            className={`font-bold ${isMe ? 'underline' : 'text-primary'}`}
          >
            {segment.text}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: positional by nature
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

export interface ChatMessageProps {
  message: ChatMessageData;
  isMe: boolean;
  /** Everyone mentionable here, so a mention can be matched back to a person. */
  collaborators: readonly MentionCandidate[];
  onReply: (message: ChatMessageData) => void;
  onToggleReaction: (messageId: Id<'chats'>, emoji: string) => void;
  onDelete: (messageId: Id<'chats'>) => void;
}

export function ChatMessage({
  message,
  isMe,
  collaborators,
  onReply,
  onToggleReaction,
  onDelete,
}: ChatMessageProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only the people this message actually named are matched, so a stray "@"
  // in the text is left as text.
  const mentioned = collaborators.filter((person) => (message.mentions ?? []).includes(person.id));

  return (
    <div
      className={`group flex max-w-[85%] gap-2.5 ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
    >
      <Avatar name={message.senderName} src={message.senderAvatar} />

      <div className="flex min-w-0 flex-col gap-1">
        <div
          className={`text-[9px] font-semibold text-muted-foreground ${
            isMe ? 'text-right' : 'text-left'
          }`}
        >
          {message.senderName}
        </div>

        <div
          className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
            isMe
              ? 'rounded-tr-none bg-primary text-primary-foreground'
              : 'rounded-tl-none bg-muted text-foreground'
          } ${
            // A message that names you is worth finding at a glance in a long
            // scrollback, so it carries a ring the others do not.
            message.mentionsMe && !isMe ? 'ring-1 ring-primary/60' : ''
          }`}
        >
          {message.quoted !== undefined && (
            <div
              className={`mb-1.5 border-l-2 pl-2 ${
                isMe ? 'border-primary-foreground/40' : 'border-primary/50'
              }`}
            >
              {message.quoted ? (
                <>
                  <p className="text-[9px] font-bold opacity-80">{message.quoted.senderName}</p>
                  <p className="truncate text-[10px] opacity-70">{message.quoted.preview}</p>
                </>
              ) : (
                <p className="text-[10px] italic opacity-60">Message deleted</p>
              )}
            </div>
          )}

          {message.attachments.length > 0 && (
            <div className={message.text ? 'mb-1.5' : ''}>
              <AttachmentList attachments={message.attachments} isMe={isMe} />
            </div>
          )}

          {message.text && (
            <p className="whitespace-pre-wrap break-words">
              <MessageText text={message.text} mentioned={mentioned} isMe={isMe} />
            </p>
          )}
        </div>

        {message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isMe ? 'justify-end' : ''}`}>
            {message.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                onClick={() => onToggleReaction(message._id, reaction.emoji)}
                title={reaction.names.join(', ')}
                className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${
                  reaction.mine
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <span>{reaction.emoji}</span>
                <span className="tabular-nums">{reaction.names.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions stay hidden until the message is hovered or focused, so a
            long conversation is not a wall of buttons. */}
        <div
          className={`relative flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
            isMe ? 'justify-end' : ''
          }`}
        >
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            title="Add a reaction"
            aria-label="Add a reaction"
            aria-expanded={pickerOpen}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <SmilePlus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onReply(message)}
            title="Reply"
            aria-label="Reply to this message"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <CornerUpLeft className="h-3 w-3" />
          </button>
          {isMe && (
            <button
              type="button"
              onClick={() => onDelete(message._id)}
              title="Delete"
              aria-label="Delete this message"
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}

          {pickerOpen && (
            <div
              className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-lg border border-border bg-background p-1 shadow-md ${
                isMe ? 'right-0' : 'left-0'
              }`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleReaction(message._id, emoji);
                    setPickerOpen(false);
                  }}
                  className="rounded p-1 text-sm leading-none transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
