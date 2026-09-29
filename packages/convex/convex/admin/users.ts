import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import type { Doc, Id } from "../_generated/dataModel.js";
import {
  type MutationCtx,
  type QueryCtx,
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server.js";
import { logAudit } from "../lib/audit.js";
import { requireAdmin } from "../lib/auth.js";
import { cascadeDeleteDocument } from "../lib/cascade.js";
import { roleValidator } from "../schema.js";

/*
 * Profile fields (name, email, avatar) are owned by Clerk and re-synced by
 * `users.upsert` on every sign-in, so nothing here edits them: an edit would
 * silently revert. The console manages the role, and deletion.
 */

async function toRow(ctx: QueryCtx, user: Doc<"users">) {
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_author", (q) => q.eq("author", user._id))
    .collect();
  return {
    ...user,
    docCount: documents.length,
    orgCount: (user.orgIds ?? []).length,
  };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    role: v.optional(roleValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = args.q?.trim();

    let page;
    if (search && search.includes("@")) {
      // The search index covers names only; an email is matched as a prefix.
      const needle = search.toLowerCase();
      const base = args.role
        ? ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", args.role as string))
        : ctx.db.query("users");
      page = await base
        .order("desc")
        .filter((f) =>
          f.and(
            f.gte(f.field("email"), needle),
            f.lt(f.field("email"), `${needle}￿`)
          )
        )
        .paginate(args.paginationOpts);
    } else if (search) {
      page = await ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) => {
          const filtered = s.search("name", search);
          return args.role ? filtered.eq("role", args.role) : filtered;
        })
        .paginate(args.paginationOpts);
    } else if (args.role) {
      page = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", args.role as string))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      page = await ctx.db.query("users").order("desc").paginate(args.paginationOpts);
    }

    return { ...page, page: await Promise.all(page.page.map((user) => toRow(ctx, user))) };
  },
});

export const roleCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const admin = users.filter((u) => u.role === "admin").length;
    return { all: users.length, admin, user: users.length - admin };
  },
});

/** Admins, for filters that pick an actor. */
export const admins = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    return rows.map((u) => ({ _id: u._id, name: u.name, email: u.email, imageUrl: u.imageUrl }));
  },
});

export const get = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(args.id);
    if (!user) return null;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_author", (q) => q.eq("author", user._id))
      .order("desc")
      .collect();

    const organizations = (
      await Promise.all(
        (user.orgIds ?? []).map((clerkOrgId) =>
          ctx.db
            .query("organizations")
            .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", clerkOrgId))
            .first()
        )
      )
    )
      .filter((org): org is Doc<"organizations"> => org !== null)
      .map((org) => ({
        _id: org._id,
        name: org.name,
        slug: org.slug,
        imageUrl: org.imageUrl,
        isOrgAdmin: org.admins.includes(user.clerkId),
      }));

    return {
      ...user,
      docCount: documents.length,
      documents: documents.slice(0, 20).map((d) => ({
        _id: d._id,
        title: d.title,
        slug: d.slug,
        status: d.status,
        updatedAt: d.updatedAt,
      })),
      organizations,
    };
  },
});

async function adminCount(ctx: QueryCtx | MutationCtx): Promise<number> {
  const rows = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "admin"))
    .collect();
  return rows.length;
}

export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.role === args.role) return target;

    if (target._id === admin._id) {
      throw new Error("You can't change your own role");
    }
    if (target.role === "admin" && args.role !== "admin" && (await adminCount(ctx)) <= 1) {
      throw new Error("At least one admin must remain");
    }

    await ctx.db.patch(target._id, { role: args.role });
    await logAudit(ctx, admin, {
      action: "user.role",
      entityType: "user",
      entityId: target._id,
      entityLabel: target.name || target.email,
      meta: { from: target.role, to: args.role },
    });
    return await ctx.db.get(target._id);
  },
});

/* -------------------------------------------------------------------------- */
/*  Deletion                                                                   */
/* -------------------------------------------------------------------------- */

const documentsPolicy = v.union(v.literal("transfer"), v.literal("delete"));

async function checkRemoval(
  ctx: QueryCtx,
  args: { userId: Id<"users">; documents: "transfer" | "delete"; transferTo?: Id<"users"> }
) {
  const admin = await requireAdmin(ctx);
  const target = await ctx.db.get(args.userId);
  if (!target) throw new Error("User not found");
  if (target._id === admin._id) throw new Error("You can't delete your own account here");

  if (args.documents === "transfer") {
    if (!args.transferTo) throw new Error("Choose who receives the documents");
    if (args.transferTo === target._id) throw new Error("Documents can't be transferred to the same user");
    const recipient = await ctx.db.get(args.transferTo);
    if (!recipient) throw new Error("The receiving user no longer exists");
  }
  return { admin, target };
}

export const _checkRemoval = internalQuery({
  args: { userId: v.id("users"), documents: documentsPolicy, transferTo: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const { target } = await checkRemoval(ctx, args);
    return { clerkId: target.clerkId };
  },
});

export const _purge = internalMutation({
  args: { userId: v.id("users"), documents: documentsPolicy, transferTo: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // Re-checked here because the Clerk call happened between the check and
    // this write, and the world may have moved.
    const { admin, target } = await checkRemoval(ctx, args);

    const owned = await ctx.db
      .query("documents")
      .withIndex("by_author", (q) => q.eq("author", target._id))
      .collect();

    for (const doc of owned) {
      if (args.documents === "transfer" && args.transferTo) {
        await ctx.db.patch(doc._id, { author: args.transferTo, updatedAt: Date.now() });
      } else {
        await cascadeDeleteDocument(ctx, doc._id);
      }
    }

    // Drop the user from mirrored org membership lists.
    for (const clerkOrgId of target.orgIds ?? []) {
      const org = await ctx.db
        .query("organizations")
        .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", clerkOrgId))
        .first();
      if (!org) continue;
      await ctx.db.patch(org._id, {
        members: org.members.filter((id) => id !== target.clerkId),
        admins: org.admins.filter((id) => id !== target.clerkId),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(target._id);
    await logAudit(ctx, admin, {
      action: "user.delete",
      entityType: "user",
      entityId: target._id,
      entityLabel: target.name || target.email,
      meta: {
        email: target.email,
        documents: owned.length,
        policy: args.documents,
        transferTo: args.transferTo,
      },
    });
    return { documents: owned.length };
  },
});

/**
 * Deletes the account in Clerk, then the Convex row and its data.
 *
 * Clerk goes first: deleting only the Convex row would be undone on the user's
 * next sign-in, when `users.upsert` recreates it. Needs `CLERK_SECRET_KEY` set
 * on the Convex deployment (`npx convex env set CLERK_SECRET_KEY sk_...`).
 */
export const remove = action({
  args: { userId: v.id("users"), documents: documentsPolicy, transferTo: v.optional(v.id("users")) },
  handler: async (ctx, args): Promise<{ documents: number }> => {
    const { clerkId } = await ctx.runQuery(internal.admin.users._checkRemoval, args);

    const secret = process.env.CLERK_SECRET_KEY;
    if (!secret) {
      throw new Error(
        "CLERK_SECRET_KEY is not set on the Convex deployment, so the Clerk account can't be deleted. Nothing was changed."
      );
    }

    const response = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });
    // 404 means the Clerk account is already gone; the Convex side still needs cleaning.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Clerk refused the deletion (${response.status}). Nothing was changed.`);
    }

    return await ctx.runMutation(internal.admin.users._purge, args);
  },
});
