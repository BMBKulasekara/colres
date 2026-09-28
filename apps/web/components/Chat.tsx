'use client';

import { useRoom, useSelf } from '@liveblocks/react/suspense';
import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useMutation as useConvexMutation, useQuery } from 'convex/react';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatComposer, type OutgoingAttachment } from './chat/ChatComposer';
import { ChatMessage, type ChatMessageData } from './chat/ChatMessage';

/**
 * Team chat for a document.
 *
 * Messages, attachments and reactions all live in Convex, which the panel
 * subscribes to — a Convex query is reactive over a websocket, so this is as
 * live as the Liveblocks LiveList it replaced, and unlike that list it can
 * hold the files and per-user reaction rows the chat now carries.
 *
 * Liveblocks is still what identifies the viewer: the room already knows who
 * is connected, so there is no reason to ask Convex a second time.
 */
export function Chat() {
  const self = useSelf();
  const room = useRoom();

  const messages = useQuery(api.chats.listMessages, { documentId: room.id });
  const collaborators = useQuery(api.chats.listCollaborators, { documentId: room.id });

  const sendMessage = useConvexMutation(api.chats.sendMessage);
  const toggleReaction = useConvexMutation(api.chats.toggleReaction);
  const deleteMessage = useConvexMutation(api.chats.deleteMessage);
  const generateUploadUrl = useConvexMutation(api.chats.generateUploadUrl);

  const [replyingTo, setReplyingTo] = useState<ChatMessageData | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Uploads one file and returns its storage id.
   *
   * The POST goes straight from the browser to Convex storage, so the file
   * never passes through a mutation argument — which is what keeps a 25 MB
   * PDF from having to be encoded into a websocket message.
   */
  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const uploadUrl = await generateUploadUrl({ documentId: room.id });
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: file.type ? { 'Content-Type': file.type } : undefined,
        body: file,
      });

      if (!response.ok) {
        throw new Error(`${file.name} could not be uploaded.`);
      }

      const { storageId } = (await response.json()) as { storageId: string };
      return storageId;
    },
    [generateUploadUrl, room.id]
  );

  const handleSend = useCallback(
    async (message: { text: string; mentions: string[]; attachments: OutgoingAttachment[] }) => {
      await sendMessage({
        documentId: room.id,
        text: message.text,
        mentions: message.mentions.length ? message.mentions : undefined,
        attachments: message.attachments.length
          ? message.attachments.map((attachment) => ({
              ...attachment,
              storageId: attachment.storageId as Id<'_storage'>,
            }))
          : undefined,
        replyTo: replyingTo?._id,
      });
      setReplyingTo(null);
    },
    [sendMessage, room.id, replyingTo]
  );

  const handleToggleReaction = useCallback(
    (messageId: Id<'chats'>, emoji: string) => {
      void toggleReaction({ messageId, emoji });
    },
    [toggleReaction]
  );

  const handleDelete = useCallback(
    (messageId: Id<'chats'>) => {
      void deleteMessage({ messageId });
      setReplyingTo((current) => (current?._id === messageId ? null : current));
    },
    [deleteMessage]
  );

  return (
    <div className="flex h-[500px] flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-xs">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages === undefined ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length > 0 ? (
          messages.map((message) => (
            <ChatMessage
              key={message._id}
              message={message as unknown as ChatMessageData}
              isMe={message.senderId === self?.id}
              collaborators={collaborators ?? []}
              onReply={setReplyingTo}
              onToggleReaction={handleToggleReaction}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <span className="mb-2 text-2xl">💬</span>
            <p className="text-xs font-semibold">No messages yet. Start the conversation!</p>
            <p className="mt-1 text-[10px]">
              Share a draft, record a voice note, or @mention a teammate.
            </p>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <ChatComposer
        collaborators={collaborators ?? []}
        uploadFile={uploadFile}
        onSend={handleSend}
        replyingTo={
          replyingTo
            ? {
                id: replyingTo._id,
                senderName: replyingTo.senderName,
                preview:
                  replyingTo.text ||
                  (replyingTo.attachments[0]?.kind === 'voice'
                    ? 'Voice message'
                    : (replyingTo.attachments[0]?.name ?? 'Attachment')),
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
}
