import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import { internalMutation, type MutationCtx, mutation, query } from "./_generated/server.js";
import { isInTrash, requireDocumentAccess } from "./lib/auth.js";
import {
  CAPTURE_LOOKBACK_MS,
  autoVersionsToPrune,
  hasChangedSince,
} from "./lib/versionPolicy.js";

/**
 * Version history.
 *
 * Automatic versions are taken by a cron job from what has been saved to
 * `documents`, so saving itself is untouched. Named versions are taken on
 * request. Restoring returns the old text to the editor, which applies it
 * through Liveblocks so every collaborator sees it, and the normal autosave
 * writes it back here.
 */

/** Documents one capture run handles before handing over to the next. */
const CAPTURE_BATCH = 100;

/** The History panel's list; older entries are reached by naming or restore. */
const LIST_LIMIT = 200;

const MAX_NAME_LENGTH = 100;

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A version needs a name");
  return trimmed.slice(0, MAX_NAME_LENGTH);
}

async function latestVersion(ctx: MutationCtx, documentId: Id<"documents">) {
  return await ctx.db
    .query("documentVersions")
    .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
    .order("desc")
    .first();
}

/** Loads a version and checks the caller can open its document. */
async function requireVersion(ctx: Parameters<typeof requireDocumentAccess>[0], id: Id<"documentVersions">) {
  const version = await ctx.db.get(id);
  if (!version) throw new Error("Version not found");
  const access = await requireDocumentAccess(ctx, version.documentId);
  return { version, ...access };
}

/** Deletes a document's automatic versions that have aged out. */
async function pruneAutoVersions(ctx: MutationCtx, documentId: Id<"documents">, now: number) {
  const versions = await ctx.db
    .query("documentVersions")
    .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
    .collect();
  const autos = versions.filter((version) => version.kind === "auto");
  for (const id of autoVersionsToPrune(autos, now)) {
    await ctx.db.delete(id);
  }
}

/** Newest first, without the text, which `get` loads on demand. */
export const list = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    await requireDocumentAccess(ctx, documentId);
    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document_created", (q) => q.eq("documentId", documentId))
      .order("desc")
      .take(LIST_LIMIT);
    return versions.map(({ content, ...meta }) => ({ ...meta, words: countWords(content) }));
  },
});

/** One version, with its text, for the preview. */
export const get = query({
  args: { versionId: v.id("documentVersions") },
  handler: async (ctx, { versionId }) => {
    const { version } = await requireVersion(ctx, versionId);
    return version;
  },
});

/**
 * Saves the document as it is now under a name. The caller should flush the
 * autosave first, so "now" includes the last few seconds of typing.
 */
export const saveNamed = mutation({
  args: { documentId: v.id("documents"), name: v.string() },
  handler: async (ctx, args) => {
    const { user, document } = await requireDocumentAccess(ctx, args.documentId);
    return await ctx.db.insert("documentVersions", {
      documentId: document._id,
      title: document.title,
      content: document.content,
      kind: "named",
      name: cleanName(args.name),
      createdBy: user._id,
      createdByName: user.name,
      createdAt: Date.now(),
    });
  },
});

/** Names an existing version, which also keeps it from being thinned out. */
export const rename = mutation({
  args: { versionId: v.id("documentVersions"), name: v.string() },
  handler: async (ctx, args) => {
    const { version } = await requireVersion(ctx, args.versionId);
    await ctx.db.patch(version._id, {
      name: cleanName(args.name),
      kind: version.kind === "auto" ? "named" : version.kind,
    });
  },
});

/**
 * First half of a restore: keeps the current text as a `restore` version, so
 * the restore can itself be undone, and returns the old text for the editor
 * to apply.
 */
export const prepareRestore = mutation({
  args: { versionId: v.id("documentVersions") },
  handler: async (ctx, { versionId }) => {
    const { version, user, document } = await requireVersion(ctx, versionId);

    if (document.content !== version.content || document.title !== version.title) {
      const label = version.name ?? new Date(version.createdAt).toISOString().slice(0, 16).replace("T", " ");
      await ctx.db.insert("documentVersions", {
        documentId: document._id,
        title: document.title,
        content: document.content,
        kind: "restore",
        name: `Before restoring ${version.name ? `"${label}"` : `the version from ${label} UTC`}`,
        createdBy: user._id,
        createdByName: user.name,
        createdAt: Date.now(),
      });
    }

    return { title: version.title, content: version.content };
  },
});

/**
 * Cron: takes an automatic version of every document saved since the last
 * run whose text has changed, then thins out that document's old ones.
 * Documents in the recycle bin are skipped; nobody can edit them.
 */
export const _captureRecent = internalMutation({
  args: { since: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    // A continuation starts strictly after the last document handled, so a
    // batch of identical timestamps cannot loop.
    const documents: Doc<"documents">[] = await ctx.db
      .query("documents")
      .withIndex("by_updated", (q) =>
        args.since === undefined
          ? q.gte("updatedAt", now - CAPTURE_LOOKBACK_MS)
          : q.gt("updatedAt", args.since)
      )
      .take(CAPTURE_BATCH);

    for (const document of documents) {
      if (await isInTrash(ctx, document._id)) continue;
      if (!hasChangedSince(document, await latestVersion(ctx, document._id))) continue;

      await ctx.db.insert("documentVersions", {
        documentId: document._id,
        title: document.title,
        content: document.content,
        kind: "auto",
        createdAt: now,
      });
      await pruneAutoVersions(ctx, document._id, now);
    }

    // A full batch may mean more are waiting; carry on from the last one.
    const last = documents[documents.length - 1];
    if (documents.length === CAPTURE_BATCH && last) {
      await ctx.scheduler.runAfter(0, internal.versions._captureRecent, {
        since: last.updatedAt,
      });
    }
  },
});

/** A rough word count of stored HTML, for the list. */
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return text.split(/\s+/).filter(Boolean).length;
}
