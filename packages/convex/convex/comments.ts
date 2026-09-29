import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { requireDocumentAccessByRef } from './lib/auth.js';
import { bumpContribution } from './lib/contributions.js';

export const saveComment = mutation({
  args: {
    documentId: v.string(),
    threadId: v.string(),
    commentId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    await bumpContribution(ctx, document._id, user._id, { comments: 1 });
    return await ctx.db.insert('comments', {
      documentId: document._id,
      threadId: args.threadId,
      commentId: args.commentId,
      text: args.text,
      senderId: user.clerkId,
      senderName: user.name,
      senderAvatar: user.imageUrl,
      createdAt: Date.now(),
    });
  },
});

/**
 * Mirrors Liveblocks comment threads into Convex so they are queryable
 * alongside the document.
 *
 * The authors of these comments are other collaborators, so `senderId` is
 * taken from the Liveblocks payload rather than the caller — but the caller
 * still has to have access to the document, and each sender is resolved
 * against the users table rather than trusted for a display name.
 */
export const syncComments = mutation({
  args: {
    documentId: v.string(),
    comments: v.array(
      v.object({
        threadId: v.string(),
        commentId: v.string(),
        text: v.string(),
        senderId: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccessByRef(ctx, args.documentId);

    for (const c of args.comments) {
      const existing = await ctx.db
        .query('comments')
        .withIndex('by_thread_id', (q) => q.eq('threadId', c.threadId))
        .filter((q) => q.eq(q.field('commentId'), c.commentId))
        .first();

      if (existing) continue;

      const sender = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', c.senderId))
        .first();

      await ctx.db.insert('comments', {
        documentId: document._id,
        threadId: c.threadId,
        commentId: c.commentId,
        text: c.text,
        senderId: c.senderId,
        senderName: sender?.name || 'Anonymous',
        senderAvatar: sender?.imageUrl || '',
        createdAt: Date.now(),
      });
    }
  },
});

export const getByDocumentId = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccessByRef(ctx, args.documentId);

    return await ctx.db
      .query('comments')
      .withIndex('by_document_id', (q) => q.eq('documentId', document._id))
      .collect();
  },
});
