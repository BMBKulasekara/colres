import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

export const saveComment = mutation({
  args: {
    documentId: v.string(),
    threadId: v.string(),
    commentId: v.string(),
    text: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('documents')
      .filter((q) =>
        q.or(
          q.eq(q.field('_id'), args.documentId),
          q.eq(q.field('slug'), args.documentId)
        )
      )
      .first();

    if (!doc) {
      throw new Error('Document not found');
    }

    return await ctx.db.insert('comments', {
      documentId: doc._id,
      threadId: args.threadId,
      commentId: args.commentId,
      text: args.text,
      senderId: args.senderId,
      senderName: args.senderName,
      senderAvatar: args.senderAvatar,
      createdAt: Date.now(),
    });
  },
});

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
    const doc = await ctx.db
      .query('documents')
      .filter((q) =>
        q.or(
          q.eq(q.field('_id'), args.documentId),
          q.eq(q.field('slug'), args.documentId)
        )
      )
      .first();

    if (!doc) return;

    for (const c of args.comments) {
      // Look up user info dynamically on Convex
      const user = await ctx.db
        .query('users')
        .withIndex('by_clerk_id', (q) => q.eq('clerkId', c.senderId))
        .first();

      const senderName = user?.name || 'Anonymous';
      const senderAvatar = user?.imageUrl || '';

      const existing = await ctx.db
        .query('comments')
        .withIndex('by_thread_id', (q) => q.eq('threadId', c.threadId))
        .filter((q) => q.eq(q.field('commentId'), c.commentId))
        .first();

      if (!existing) {
        await ctx.db.insert('comments', {
          documentId: doc._id,
          threadId: c.threadId,
          commentId: c.commentId,
          text: c.text,
          senderId: c.senderId,
          senderName,
          senderAvatar,
          createdAt: Date.now(),
        });
      }
    }
  },
});

export const getByDocumentId = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query('documents')
      .filter((q) =>
        q.or(
          q.eq(q.field('_id'), args.documentId),
          q.eq(q.field('slug'), args.documentId)
        )
      )
      .first();

    if (!doc) return [];

    return await ctx.db
      .query('comments')
      .withIndex('by_document_id', (q) => q.eq('documentId', doc._id))
      .collect();
  },
});
