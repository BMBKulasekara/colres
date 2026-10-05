import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel.js";
import { type MutationCtx, mutation, query } from "./_generated/server.js";
import {
  documentRole,
  getUserOrNull,
  isDocumentMember,
  isInTrash,
  requireDocumentAccess,
  requireUser,
} from "./lib/auth.js";
import { notify } from "./lib/notify.js";
import { ROLE_LABELS, canManageSharing, looksLikeEmail, normalizeEmail } from "./lib/sharing.js";

/**
 * Sharing a document with people outside its workspace.
 *
 * The author and organization members manage sharing; people it is shared
 * with cannot pass it on. Rows are keyed by email, so an invite works before
 * the person has an account.
 */

const sharedRole = v.union(v.literal("editor"), v.literal("commenter"), v.literal("viewer"));

/** The caller's role, and whether they may manage sharing. Null for no access. */
export const myRole = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    const user = await getUserOrNull(ctx);
    const document = await ctx.db.get(documentId);
    if (!user || !document) return null;
    const role = await documentRole(ctx, document, user);
    return role ? { role, canManage: canManageSharing(role) } : null;
  },
});

/**
 * The caller's role in a Liveblocks room, for the auth route. Rooms are named
 * by document id; anything else gets no access.
 */
export const roomAccess = query({
  args: { room: v.string() },
  handler: async (ctx, { room }) => {
    const user = await getUserOrNull(ctx);
    const id = ctx.db.normalizeId("documents", room);
    if (!user || !id) return null;
    const document = await ctx.db.get(id);
    if (!document) return null;
    return await documentRole(ctx, document, user);
  },
});

/** Who the document is shared with, for anyone who can open it. */
export const listMembers = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, { documentId }) => {
    await requireDocumentAccess(ctx, documentId, "view");
    const rows = await ctx.db
      .query("documentMembers")
      .withIndex("by_document_email", (q) => q.eq("documentId", documentId))
      .collect();

    return await Promise.all(
      rows.map(async (row) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", row.email))
          .first();
        return {
          _id: row._id,
          email: row.email,
          role: row.role,
          name: user?.name,
          imageUrl: user?.imageUrl,
          /** False until they sign up with this email. */
          hasAccount: user !== null,
        };
      })
    );
  },
});

async function requireManager(ctx: MutationCtx, documentId: Id<"documents">) {
  const access = await requireDocumentAccess(ctx, documentId, "view");
  if (!canManageSharing(access.role)) {
    throw new Error("Forbidden: only the author and organization members can share this document");
  }
  return access;
}

/** Shares the document with an email address, or changes the role of an existing invite. */
export const invite = mutation({
  args: { documentId: v.id("documents"), email: v.string(), role: sharedRole },
  handler: async (ctx, args) => {
    const { user, document } = await requireManager(ctx, args.documentId);
    const email = normalizeEmail(args.email);
    if (!looksLikeEmail(email)) throw new Error("Enter a valid email address");

    // Someone who already has full access through the workspace does not
    // need, and must not be narrowed by, an invite.
    const invitee = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (invitee && isDocumentMember(document, invitee)) {
      throw new Error(
        invitee._id === user._id
          ? "You already have access to this document"
          : "This person already has access through the organization"
      );
    }

    const existing = await ctx.db
      .query("documentMembers")
      .withIndex("by_document_email", (q) => q.eq("documentId", document._id).eq("email", email))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role });
      return existing._id;
    }
    const memberId = await ctx.db.insert("documentMembers", {
      documentId: document._id,
      email,
      role: args.role,
      invitedBy: user._id,
      createdAt: Date.now(),
    });
    // Someone without an account yet sees it under "Shared with me" instead.
    if (invitee) {
      await notify(ctx, [invitee._id], {
        kind: "share",
        documentId: document._id,
        actor: user,
        preview: ROLE_LABELS[args.role],
      });
    }
    return memberId;
  },
});

export const setRole = mutation({
  args: { memberId: v.id("documentMembers"), role: sharedRole },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) throw new Error("Not found");
    await requireManager(ctx, member.documentId);
    await ctx.db.patch(member._id, { role: args.role });
  },
});

/** Removes someone's access. Managers can remove anyone; anyone can remove themselves. */
export const remove = mutation({
  args: { memberId: v.id("documentMembers") },
  handler: async (ctx, args) => {
    const member = await ctx.db.get(args.memberId);
    if (!member) return;
    const user = await requireUser(ctx);
    if (normalizeEmail(user.email) !== member.email) {
      await requireManager(ctx, member.documentId);
    }
    await ctx.db.delete(member._id);
  },
});

/**
 * Documents shared with the caller from outside their own workspaces, most
 * recently edited first. Binned documents are left out.
 */
export const sharedWithMe = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserOrNull(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("documentMembers")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(user.email)))
      .collect();

    const results: { document: Doc<"documents">; role: Doc<"documentMembers">["role"] }[] = [];
    for (const row of rows) {
      const document = await ctx.db.get(row.documentId);
      if (!document || isDocumentMember(document, user)) continue;
      if (await isInTrash(ctx, document._id)) continue;
      results.push({ document, role: row.role });
    }
    return results.sort((a, b) => b.document.updatedAt - a.document.updatedAt);
  },
});
