import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { canAccessDocument, getUserOrNull, requireDocumentAccessByRef } from "./lib/auth.js";
import { bumpContribution, summarizeDocument } from "./lib/contributions.js";

/**
 * Upper bounds for one flush. The client flushes about every minute, so these
 * are generous for real typing or pasting but stop a hand-crafted call from
 * inflating someone's numbers by millions in one go.
 */
const MAX_WORDS = 5_000;
const MAX_CHARS = 50_000;
const MAX_MINUTES = 5;

const clamp = (n: number, max: number) => Math.max(0, Math.min(Math.floor(n), max));

/** Editor activity buffered in the browser, flushed about once a minute. */
export const record = mutation({
  args: {
    documentId: v.string(),
    wordsAdded: v.number(),
    charsAdded: v.number(),
    charsDeleted: v.number(),
    activeMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccessByRef(ctx, args.documentId);
    const deltas = {
      wordsAdded: clamp(args.wordsAdded, MAX_WORDS),
      charsAdded: clamp(args.charsAdded, MAX_CHARS),
      charsDeleted: clamp(args.charsDeleted, MAX_CHARS),
      activeMinutes: clamp(args.activeMinutes, MAX_MINUTES),
    };
    if (!deltas.charsAdded && !deltas.charsDeleted && !deltas.activeMinutes) return;
    await bumpContribution(ctx, document._id, user._id, deltas);
  },
});

/** Contribution breakdown for everyone on a document the caller can open. */
export const forDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await getUserOrNull(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!user || !document || !(await canAccessDocument(ctx, document, user, "view"))) return null;
    return { ...(await summarizeDocument(ctx, document._id)), viewerId: user._id };
  },
});

