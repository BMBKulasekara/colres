import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import {
  type ActionCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server.js";
import { logAudit } from "./lib/audit.js";
import { getUserOrNull, isDocumentMember, requireUser } from "./lib/auth.js";
import { cascadeDeleteDocument } from "./lib/cascade.js";
import { canDeleteForever, purgeTimeFor } from "./lib/trashPolicy.js";

/**
 * The recycle bin.
 *
 * Binning adds a row to `trash` and leaves the document where it is; restoring
 * removes the row. Only "delete forever" and the 30-day clean-up erase, and
 * both go through `cascadeDeleteDocument`, the one place anything is erased.
 */

/** How many expired items one clean-up run erases before scheduling the next. */
const PURGE_BATCH = 50;

async function findEntry(ctx: { db: QueryCtx["db"] }, documentId: Id<"documents">) {
  return await ctx.db
    .query("trash")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .first();
}

/** Puts a document in the bin. Anyone who can open it can bin it. */
export const moveToTrash = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const document = await ctx.db.get(id);
    if (!document || !isDocumentMember(document, user)) {
      throw new Error("Document not found");
    }
    if (await findEntry(ctx, id)) return;

    const deletedAt = Date.now();
    await ctx.db.insert("trash", {
      documentId: id,
      orgId: document.orgId,
      author: document.author,
      deletedBy: user._id,
      deletedAt,
      purgeAt: purgeTimeFor(deletedAt),
    });
  },
});

/** Takes a document out of the bin, exactly as it was. */
export const restore = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const entry = await findEntry(ctx, id);
    if (!entry) return;
    if (!isDocumentMember(entry, user)) {
      throw new Error("Document not found");
    }
    await ctx.db.delete(entry._id);
  },
});

/**
 * The bin of one workspace: an organization's, or with no `orgId`, the
 * caller's personal one. Newest first.
 *
 * `canDeleteForever` here is a hint for which buttons to show, worked out from
 * the membership Convex has on file. The real decision is made against Clerk
 * when the button is pressed.
 */
export const listTrash = query({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, { orgId }) => {
    // Empty rather than an error while the profile row is still syncing.
    const user = await getUserOrNull(ctx);
    if (!user) return [];

    let entries: Doc<"trash">[];
    if (orgId) {
      if (!(user.orgIds ?? []).includes(orgId)) return [];
      entries = await ctx.db
        .query("trash")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .order("desc")
        .collect();
    } else {
      entries = (
        await ctx.db
          .query("trash")
          .withIndex("by_author", (q) => q.eq("author", user._id))
          .order("desc")
          .collect()
      ).filter((entry) => !entry.orgId);
    }

    const org = orgId
      ? await ctx.db
          .query("organizations")
          .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", orgId))
          .first()
      : null;
    const callerIsOrgAdmin = org?.admins.includes(user.clerkId) ?? false;

    const rows = await Promise.all(
      entries.map(async (entry) => {
        const [document, deletedBy, author] = await Promise.all([
          ctx.db.get(entry.documentId),
          ctx.db.get(entry.deletedBy),
          ctx.db.get(entry.author),
        ]);
        if (!document) return null;

        return {
          documentId: entry.documentId,
          title: document.title,
          templateName: document.templateSnapshot?.name ?? null,
          deletedAt: entry.deletedAt,
          purgeAt: entry.purgeAt,
          deletedByName: deletedBy?.name || deletedBy?.email || "Someone",
          authorName: author?.name || author?.email || "A former member",
          isAuthor: entry.author === user._id,
          canDeleteForever: canDeleteForever({
            isAuthor: entry.author === user._id,
            isPersonal: !entry.orgId,
            callerIsOrgAdmin,
            authorStillMember: !!entry.orgId && (author?.orgIds ?? []).includes(entry.orgId),
          }),
        };
      })
    );
    return rows.filter((row) => row !== null);
  },
});

/** What "delete forever" needs to know from the database before asking Clerk. */
export const _deleteFacts = internalQuery({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const entry = await findEntry(ctx, id);
    if (!entry || !isDocumentMember(entry, user)) {
      throw new Error("That document is not in your bin.");
    }
    const author = await ctx.db.get(entry.author);
    return {
      isAuthor: entry.author === user._id,
      orgId: entry.orgId ?? null,
      callerClerkId: user.clerkId,
      authorClerkId: author?.clerkId ?? null,
    };
  },
});

/** The binned documents of one workspace, for "Empty bin". */
export const _workspaceEntries = internalQuery({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, { orgId }) => {
    const user = await requireUser(ctx);
    if (orgId) {
      if (!(user.orgIds ?? []).includes(orgId)) return [];
      const entries = await ctx.db
        .query("trash")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
      return entries.map((entry) => entry.documentId);
    }
    const entries = await ctx.db
      .query("trash")
      .withIndex("by_author", (q) => q.eq("author", user._id))
      .collect();
    return entries.filter((entry) => !entry.orgId).map((entry) => entry.documentId);
  },
});

/** Erases one binned document. Only called once the caller has been cleared. */
export const _erase = internalMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }) => {
    // Re-checked here: the Clerk call happened between the check and this
    // write, and someone may have restored the document meanwhile.
    const user = await requireUser(ctx);
    const entry = await findEntry(ctx, id);
    if (!entry || !isDocumentMember(entry, user)) {
      throw new Error("That document is no longer in the bin.");
    }
    const document = await ctx.db.get(id);

    await cascadeDeleteDocument(ctx, id);
    await logAudit(ctx, user, {
      action: "document.deleteForever",
      entityType: "document",
      entityId: id,
      entityLabel: document?.title ?? "Untitled Document",
      meta: { byAuthor: entry.author === user._id },
    });
  },
});

/**
 * Asks Clerk, live, whether the caller is an admin of `orgId` and whether the
 * author is still a member. The membership Convex keeps is copied from the
 * browser and can be out of date; an erase cannot be undone, so it is not
 * trusted for this.
 */
async function fetchOrgMembership(
  orgId: string,
  callerClerkId: string,
  authorClerkId: string | null
): Promise<{ callerIsOrgAdmin: boolean; authorStillMember: boolean }> {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "CLERK_SECRET_KEY is not set on the Convex deployment, so membership can't be checked. Nothing was deleted."
    );
  }

  const params = new URLSearchParams({ limit: "10" });
  params.append("user_id", callerClerkId);
  if (authorClerkId) params.append("user_id", authorClerkId);

  const response = await fetch(
    `https://api.clerk.com/v1/organizations/${encodeURIComponent(orgId)}/memberships?${params}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );
  if (!response.ok) {
    throw new Error(`Clerk could not confirm membership (${response.status}). Nothing was deleted.`);
  }

  const { data } = (await response.json()) as {
    data: { role: string; public_user_data?: { user_id?: string } }[];
  };
  const roleOf = (clerkId: string | null) =>
    clerkId ? data.find((m) => m.public_user_data?.user_id === clerkId)?.role : undefined;

  const callerRole = roleOf(callerClerkId);
  return {
    callerIsOrgAdmin: callerRole === "org:admin" || callerRole === "admin",
    authorStillMember: roleOf(authorClerkId) !== undefined,
  };
}

/** Erases one document if the caller is allowed to; false when they are not. */
async function eraseIfAllowed(ctx: ActionCtx, id: Id<"documents">): Promise<boolean> {
  const facts = await ctx.runQuery(internal.trash._deleteFacts, { id });

  const membership =
    facts.isAuthor || !facts.orgId
      ? { callerIsOrgAdmin: false, authorStillMember: true }
      : await fetchOrgMembership(facts.orgId, facts.callerClerkId, facts.authorClerkId);

  const allowed = canDeleteForever({
    isAuthor: facts.isAuthor,
    isPersonal: !facts.orgId,
    ...membership,
  });
  if (!allowed) return false;

  await ctx.runMutation(internal.trash._erase, { id });
  return true;
}

/** Erases a binned document for good: its author, or an org admin once the author has left. */
export const deleteForever = action({
  args: { id: v.id("documents") },
  handler: async (ctx, { id }): Promise<void> => {
    if (!(await eraseIfAllowed(ctx, id))) {
      throw new Error("Only the author can delete this forever.");
    }
  },
});

/** Erases everything in a workspace's bin that the caller is allowed to erase. */
export const emptyTrash = action({
  args: { orgId: v.optional(v.string()) },
  handler: async (ctx, { orgId }): Promise<{ deleted: number; kept: number }> => {
    const ids = await ctx.runQuery(internal.trash._workspaceEntries, { orgId });
    let deleted = 0;
    for (const id of ids) {
      if (await eraseIfAllowed(ctx, id)) deleted++;
    }
    return { deleted, kept: ids.length - deleted };
  },
});

/** The daily clean-up: erases everything that has been in the bin for 30 days. */
export const _purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("trash")
      .withIndex("by_purge_at", (q) => q.lte("purgeAt", Date.now()))
      .take(PURGE_BATCH);

    for (const entry of expired) {
      if (await ctx.db.get(entry.documentId)) {
        await cascadeDeleteDocument(ctx, entry.documentId);
      } else {
        await ctx.db.delete(entry._id);
      }
    }

    // A full batch may mean more are waiting; carry on without waiting a day.
    if (expired.length === PURGE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.trash._purgeExpired, {});
    }
  },
});
