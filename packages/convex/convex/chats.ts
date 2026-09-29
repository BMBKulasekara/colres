import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel.js';
import { type QueryCtx, mutation, query } from './_generated/server.js';
import { requireDocumentAccessByRef } from './lib/auth.js';
import { bumpContribution } from './lib/contributions.js';
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_BYTES,
  MAX_VOICE_SECONDS,
  checkAttachment,
  isVoiceMimeType,
} from './lib/chatAttachments.js';

/**
 * Team chat.
 *
 * Convex holds the messages; it is not a mirror of something else. An earlier
 * version kept the live copy in a Liveblocks LiveList and wrote a second copy
 * here, which stopped being workable once messages could carry files: blobs
 * cannot live in Liveblocks Storage, so the file had to be in Convex, and a
 * message whose body is here while its reactions are there has two sources of
 * truth and no way to resolve a disagreement between them. Convex queries are
 * reactive over a websocket, so the chat is live either way.
 */

const attachmentInput = v.object({
  storageId: v.id('_storage'),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
  kind: v.union(v.literal('file'), v.literal('image'), v.literal('voice')),
  durationSec: v.optional(v.number()),
});

/**
 * A short-lived URL the browser can POST a file to.
 *
 * Access is checked here, at the point the URL is issued, because the upload
 * itself goes straight to Convex storage and carries no document reference for
 * a later check to use.
 */
export const generateUploadUrl = mutation({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    await requireDocumentAccessByRef(ctx, args.documentId);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Re-checks an attachment the client says it has uploaded.
 *
 * The browser ran the same check before uploading, but the deployment URL is
 * in the page bundle and this mutation can be called directly, so the file's
 * declared name, type and size are all attacker-controlled. The stored blob's
 * real size is read back from storage metadata rather than trusted, which is
 * the one field a caller could otherwise lie about to slip past the limit.
 */
async function validateAttachment(
  ctx: QueryCtx,
  attachment: {
    storageId: Id<'_storage'>;
    name: string;
    mimeType: string;
    size: number;
    kind: 'file' | 'image' | 'voice';
    durationSec?: number;
  }
) {
  const metadata = await ctx.db.system.get(attachment.storageId);
  if (!metadata) {
    throw new Error('That upload could not be found. Try attaching the file again.');
  }
  if (metadata.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('That file is larger than attachments are allowed to be.');
  }

  if (attachment.kind === 'voice') {
    if (!isVoiceMimeType(attachment.mimeType)) {
      throw new Error('That is not an audio recording.');
    }
    const seconds = attachment.durationSec ?? 0;
    if (seconds <= 0 || seconds > MAX_VOICE_SECONDS) {
      throw new Error('A voice message must be between a moment and five minutes long.');
    }
    return { ...attachment, size: metadata.size };
  }

  const verdict = checkAttachment(attachment.name, attachment.mimeType, metadata.size);
  if (!verdict.ok) {
    throw new Error(verdict.reason);
  }

  // The kind decides how the bubble renders the attachment, so it is taken
  // from the allowlist rather than from what the caller asked for.
  return { ...attachment, kind: verdict.type.kind, size: metadata.size };
}

export const sendMessage = mutation({
  args: {
    documentId: v.string(),
    text: v.string(),
    replyTo: v.optional(v.id('chats')),
    mentions: v.optional(v.array(v.string())),
    attachments: v.optional(v.array(attachmentInput)),
  },
  handler: async (ctx, args) => {
    // Sender identity comes from the verified session, never from the client:
    // accepting a senderId argument let anyone post as anyone else.
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    const text = args.text.trim();
    const attachments = args.attachments ?? [];

    // A message with a file and no words is an ordinary thing to send; one
    // with neither is a mis-click.
    if (!text && attachments.length === 0) {
      throw new Error('Message cannot be empty');
    }
    if (attachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
      throw new Error(`At most ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message.`);
    }

    const validated = [];
    for (const attachment of attachments) {
      validated.push(await validateAttachment(ctx, attachment));
    }

    // A reply has to point at a message in this same document, or a caller
    // could thread one conversation onto another they cannot read.
    if (args.replyTo) {
      const parent = await ctx.db.get(args.replyTo);
      if (!parent || parent.documentId !== document._id) {
        throw new Error('That message is not part of this conversation.');
      }
    }

    // Only people who can actually see the document can be mentioned in it.
    const mentions = args.mentions?.length
      ? (await collaboratorIds(ctx, document)).filter((id) => args.mentions?.includes(id))
      : undefined;

    await bumpContribution(ctx, document._id, user._id, { messages: 1 });
    return await ctx.db.insert('chats', {
      documentId: document._id,
      text,
      senderId: user.clerkId,
      senderName: user.name,
      senderAvatar: user.imageUrl,
      createdAt: Date.now(),
      replyTo: args.replyTo,
      mentions: mentions?.length ? mentions : undefined,
      attachments: validated.length ? validated : undefined,
    });
  },
});

/**
 * Adds a reaction, or takes it back if the caller had already left that one.
 *
 * One call for both directions because that is how the button behaves: there
 * is no separate "un-react" gesture to give a separate mutation to.
 */
export const toggleReaction = mutation({
  args: { messageId: v.id('chats'), emoji: v.string() },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error('That message no longer exists.');
    }
    const { user } = await requireDocumentAccessByRef(ctx, message.documentId);

    const emoji = args.emoji.trim();
    if (!emoji || emoji.length > 8) {
      throw new Error('That is not an emoji.');
    }

    const existing = await ctx.db
      .query('chatReactions')
      .withIndex('by_message_user_emoji', (q) =>
        q.eq('messageId', args.messageId).eq('userId', user.clerkId).eq('emoji', emoji)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { reacted: false };
    }

    await ctx.db.insert('chatReactions', {
      messageId: args.messageId,
      documentId: message.documentId,
      userId: user.clerkId,
      userName: user.name,
      emoji,
      createdAt: Date.now(),
    });
    return { reacted: true };
  },
});

/** Deletes one's own message, attachments and all. */
export const deleteMessage = mutation({
  args: { messageId: v.id('chats') },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    const { user } = await requireDocumentAccessByRef(ctx, message.documentId);
    if (message.senderId !== user.clerkId) {
      throw new Error('Only the sender can delete a message.');
    }

    const reactions = await ctx.db
      .query('chatReactions')
      .withIndex('by_message', (q) => q.eq('messageId', args.messageId))
      .collect();
    for (const reaction of reactions) await ctx.db.delete(reaction._id);

    // Replies are kept: deleting the message they answer should not silently
    // remove other people's words. They render as "message deleted" instead.
    for (const attachment of message.attachments ?? []) {
      await ctx.storage.delete(attachment.storageId);
    }

    await ctx.db.delete(args.messageId);
  },
});

/**
 * Clerk ids of everyone who can read the document, author first.
 *
 * Membership is read from the organisation's own roster rather than by
 * scanning `users` for everyone whose `orgIds` contains this org: the roster
 * is a single indexed read, and the scan would grow with the size of the whole
 * user table every time somebody opened the mention picker.
 */
async function collaboratorIds(ctx: QueryCtx, document: Doc<'documents'>): Promise<string[]> {
  const author = await ctx.db.get(document.author);
  const ids = author ? [author.clerkId] : [];

  if (document.orgId) {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_clerk_org_id', (q) => q.eq('clerkOrgId', document.orgId as string))
      .first();

    for (const clerkId of org?.members ?? []) {
      if (!ids.includes(clerkId)) ids.push(clerkId);
    }
  }

  return ids;
}

/**
 * Everyone who can be mentioned in this document's chat.
 *
 * The author plus, for an org document, that organisation's members — which is
 * exactly the set `canAccessDocument` admits, so the picker cannot offer
 * somebody the server would then refuse to record.
 */
export const listCollaborators = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccessByRef(ctx, args.documentId);
    const ids = await collaboratorIds(ctx, document);

    const people = [];
    for (const clerkId of ids) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', clerkId))
        .first();
      if (user) {
        people.push({ id: user.clerkId, name: user.name, avatar: user.imageUrl });
      }
    }
    return people;
  },
});

/**
 * The conversation, oldest first, with everything a bubble needs to render.
 *
 * Attachment URLs are signed here rather than in the browser because
 * `ctx.storage.getUrl` is a server call; reactions arrive grouped by emoji so
 * the client is not regrouping the same rows on every keystroke.
 */
export const listMessages = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    const messages = await ctx.db
      .query('chats')
      .withIndex('by_document_and_time', (q) => q.eq('documentId', document._id))
      .order('asc')
      .collect();

    const reactions = await ctx.db
      .query('chatReactions')
      .withIndex('by_document', (q) => q.eq('documentId', document._id))
      .collect();

    const byMessage = new Map<string, typeof reactions>();
    for (const reaction of reactions) {
      const list = byMessage.get(reaction.messageId) ?? [];
      list.push(reaction);
      byMessage.set(reaction.messageId, list);
    }

    /** Sender and a one-line preview of the message a reply is answering. */
    const quoted = new Map<string, { senderName: string; preview: string }>();
    for (const message of messages) {
      quoted.set(message._id, {
        senderName: message.senderName,
        preview: message.text || describeAttachments(message.attachments),
      });
    }

    return await Promise.all(
      messages.map(async (message) => {
        const grouped = new Map<string, { emoji: string; names: string[]; mine: boolean }>();
        for (const reaction of byMessage.get(message._id) ?? []) {
          const entry = grouped.get(reaction.emoji) ?? {
            emoji: reaction.emoji,
            names: [],
            mine: false,
          };
          entry.names.push(reaction.userName);
          if (reaction.userId === user.clerkId) entry.mine = true;
          grouped.set(reaction.emoji, entry);
        }

        const attachments = await Promise.all(
          (message.attachments ?? []).map(async (attachment) => ({
            ...attachment,
            url: await ctx.storage.getUrl(attachment.storageId),
          }))
        );

        return {
          ...message,
          attachments,
          reactions: [...grouped.values()],
          // Null rather than absent when the quoted message has since been
          // deleted, so the bubble can say so instead of dropping the context.
          quoted: message.replyTo ? (quoted.get(message.replyTo) ?? null) : undefined,
          mentionsMe: (message.mentions ?? []).includes(user.clerkId),
        };
      })
    );
  },
});

/**
 * The unread badge and the notification, as one subscription.
 *
 * Both need the same two facts — how many messages have arrived since this
 * person last read, and what the newest one says — and both have to keep
 * working while the chat panel is shut. Answering them together means the
 * editor page holds one lightweight subscription rather than streaming the
 * whole conversation in the background just to count it.
 *
 * Your own messages never count as unread: sending one is the most definite
 * way there is of having read it.
 */
export const chatUnread = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    const marker = await ctx.db
      .query('chatReads')
      .withIndex('by_document_and_user', (q) =>
        q.eq('documentId', document._id).eq('userId', user.clerkId)
      )
      .first();

    const lastReadAt = marker?.lastReadAt ?? 0;

    const since = await ctx.db
      .query('chats')
      .withIndex('by_document_and_time', (q) =>
        q.eq('documentId', document._id).gt('createdAt', lastReadAt)
      )
      .collect();

    const unread = since.filter((message) => message.senderId !== user.clerkId);
    const latest = unread[unread.length - 1];

    return {
      count: unread.length,
      mentionsMe: unread.some((message) => (message.mentions ?? []).includes(user.clerkId)),
      latest: latest
        ? {
            id: latest._id,
            senderName: latest.senderName,
            senderAvatar: latest.senderAvatar,
            preview: latest.text || describeAttachments(latest.attachments),
            createdAt: latest.createdAt,
          }
        : null,
    };
  },
});

/**
 * Marks the conversation read up to now.
 *
 * Takes no timestamp from the caller: "now" on the server is the only clock
 * both sides agree on, and a client whose clock runs fast would otherwise mark
 * messages read before they had been sent.
 */
export const markChatRead = mutation({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    const existing = await ctx.db
      .query('chatReads')
      .withIndex('by_document_and_user', (q) =>
        q.eq('documentId', document._id).eq('userId', user.clerkId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
      return;
    }

    await ctx.db.insert('chatReads', {
      documentId: document._id,
      userId: user.clerkId,
      lastReadAt: Date.now(),
    });
  },
});

/** "2 attachments" — what a reply quotes when the message it answers has no words. */
function describeAttachments(attachments: Doc<'chats'>['attachments']): string {
  if (!attachments?.length) return 'Message';
  if (attachments.length === 1) {
    const only = attachments[0];
    if (only?.kind === 'voice') return 'Voice message';
    return only?.name ?? 'Attachment';
  }
  return `${attachments.length} attachments`;
}

/** @deprecated Use `listMessages`, which carries attachments and reactions. */
export const getByDocumentId = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccessByRef(ctx, args.documentId);

    return await ctx.db
      .query('chats')
      .withIndex('by_document_id', (q) => q.eq('documentId', document._id))
      .collect();
  },
});
