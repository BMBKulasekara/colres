import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

/**
 * Rows keyed to a document, counted without deleting them. The admin console
 * shows these before a delete so the confirmation states what will go with it.
 */
export async function countDocumentDependents(
  ctx: { db: QueryCtx["db"] },
  id: Id<"documents">
) {
  const [chats, comments, references] = await Promise.all([
    ctx.db
      .query("chats")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("comments")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("references")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
  ]);
  return { chats: chats.length, comments: comments.length, references: references.length };
}

/** Removes the document and everything keyed to it. */
export async function cascadeDeleteDocument(ctx: MutationCtx, id: Id<"documents">) {
  const related = await Promise.all([
    ctx.db
      .query("chats")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("chatReactions")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("chatReads")
      .withIndex("by_document_and_user", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("comments")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("references")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("paperSuggestions")
      .withIndex("by_document_id", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("contributionStats")
      .withIndex("by_document_and_day", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("trash")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("documentVersions")
      .withIndex("by_document_created", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("documentSearch")
      .withIndex("by_document", (q) => q.eq("documentId", id))
      .collect(),
    ctx.db
      .query("documentMembers")
      .withIndex("by_document_email", (q) => q.eq("documentId", id))
      .collect(),
  ]);

  for (const row of related.flat()) {
    await ctx.db.delete(row._id);
  }

  await ctx.db.delete(id);
}
