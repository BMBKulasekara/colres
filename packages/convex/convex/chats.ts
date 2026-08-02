import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

export const sendMessage = mutation({
  args: {
    documentId: v.string(),
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

    return await ctx.db.insert('chats', {
      documentId: doc._id,
      text: args.text,
      senderId: args.senderId,
      senderName: args.senderName,
      senderAvatar: args.senderAvatar,
      createdAt: Date.now(),
    });
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
      .query('chats')
      .withIndex('by_document_id', (q) => q.eq('documentId', doc._id))
      .collect();
  },
});
