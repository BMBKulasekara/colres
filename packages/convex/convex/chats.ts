import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';
import { requireDocumentAccessByRef } from './lib/auth.js';

export const sendMessage = mutation({
  args: {
    documentId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // Sender identity comes from the verified session, never from the client:
    // accepting a senderId argument let anyone post as anyone else.
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);

    const text = args.text.trim();
    if (!text) {
      throw new Error('Message cannot be empty');
    }

    return await ctx.db.insert('chats', {
      documentId: document._id,
      text,
      senderId: user.clerkId,
      senderName: user.name,
      senderAvatar: user.imageUrl,
      createdAt: Date.now(),
    });
  },
});

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
