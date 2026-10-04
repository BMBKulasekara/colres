import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import { internalMutation, type MutationCtx, query } from "./_generated/server.js";
import { canAccessDocument, getUserOrNull } from "./lib/auth.js";
import { INDEX_INTERVAL_MINUTES, searchTextFor, snippetFor } from "./lib/searchText.js";

/**
 * Full-text search over document titles and bodies.
 *
 * `documentSearch` is filled by a cron job from what has been saved, so
 * saving itself is untouched. Results are limited to the workspace being
 * viewed, the same rule as the documents page: an organization's documents,
 * or the caller's personal ones.
 */

/** Longer than the job's interval, so a late run does not skip anything. */
const INDEX_LOOKBACK_MS = (INDEX_INTERVAL_MINUTES + 2) * 60 * 1000;

/** Documents one indexing or backfill run handles before handing over. */
const INDEX_BATCH = 50;

const MAX_RESULTS = 20;

/** Shorter queries match too much of everything to be useful. */
const MIN_QUERY_LENGTH = 2;

/** Writes or refreshes the search row for one document. */
async function indexDocument(ctx: MutationCtx, document: Doc<"documents">) {
  const existing = await ctx.db
    .query("documentSearch")
    .withIndex("by_document", (q) => q.eq("documentId", document._id))
    .first();
  if (existing && existing.updatedAt >= document.updatedAt) return;

  const row = {
    documentId: document._id,
    orgId: document.orgId,
    author: document.author,
    text: searchTextFor(document.title, document.content),
    updatedAt: document.updatedAt,
  };
  if (existing) await ctx.db.replace(existing._id, row);
  else await ctx.db.insert("documentSearch", row);
}

/**
 * Documents in the viewed workspace whose title or text matches, best match
 * first, each with an excerpt showing where it matched.
 */
export const documents = query({
  args: { query: v.string(), orgId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await getUserOrNull(ctx);
    if (!user) return [];
    const text = args.query.trim();
    if (text.length < MIN_QUERY_LENGTH) return [];
    if (args.orgId && !(user.orgIds ?? []).includes(args.orgId)) return [];

    const rows = await ctx.db
      .query("documentSearch")
      .withSearchIndex("search_text", (s) =>
        args.orgId
          ? s.search("text", text).eq("orgId", args.orgId)
          : s.search("text", text).eq("author", user._id)
      )
      .take(MAX_RESULTS * 2);

    const results: { document: Doc<"documents">; snippet: string }[] = [];
    for (const row of rows) {
      if (results.length === MAX_RESULTS) break;
      const document = await ctx.db.get(row.documentId);
      if (!document) continue;
      // The row only narrowed the search; the document decides. A personal
      // search leaves out org documents the caller wrote, as the page does.
      const inWorkspace = args.orgId
        ? document.orgId === args.orgId
        : !document.orgId && document.author === user._id;
      if (!inWorkspace || !(await canAccessDocument(ctx, document, user))) continue;
      results.push({ document, snippet: snippetFor(row.text, text) });
    }
    return results;
  },
});

/** Cron: indexes documents saved since the last run. */
export const _indexRecent = internalMutation({
  args: { since: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // A continuation starts strictly after the last document handled, so a
    // batch of identical timestamps cannot loop.
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_updated", (q) =>
        args.since === undefined
          ? q.gte("updatedAt", Date.now() - INDEX_LOOKBACK_MS)
          : q.gt("updatedAt", args.since)
      )
      .take(INDEX_BATCH);

    for (const document of documents) await indexDocument(ctx, document);

    const last = documents[documents.length - 1];
    if (documents.length === INDEX_BATCH && last) {
      await ctx.scheduler.runAfter(0, internal.search._indexRecent, { since: last.updatedAt });
    }
  },
});

/**
 * One-off: indexes every existing document, a batch at a time. Run once after
 * deploying with `npx convex run search:_backfill`; it is safe to run again.
 */
export const _backfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("documents")
      .paginate({ numItems: INDEX_BATCH, cursor: args.cursor ?? null });

    for (const document of page.page) await indexDocument(ctx, document);

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.search._backfill, { cursor: page.continueCursor });
    }
  },
});
