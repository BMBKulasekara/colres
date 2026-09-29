import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel.js";
import { type QueryCtx, query } from "../_generated/server.js";
import { requireAdmin } from "../lib/auth.js";

/*
 * Organizations are owned by Clerk and mirrored here by members of each org,
 * so the console only reads them.
 */

async function toRow(ctx: QueryCtx, org: Doc<"organizations">) {
  const documents = await ctx.db
    .query("documents")
    .withIndex("by_org_id", (q) => q.eq("orgId", org.clerkOrgId))
    .collect();
  return { ...org, memberCount: org.members.length, docCount: documents.length };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, q: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = args.q?.trim();

    const page = search
      ? await ctx.db
          .query("organizations")
          .withSearchIndex("search_name", (s) => s.search("name", search))
          .paginate(args.paginationOpts)
      : await ctx.db.query("organizations").order("desc").paginate(args.paginationOpts);

    return { ...page, page: await Promise.all(page.page.map((org) => toRow(ctx, org))) };
  },
});

/** Every organization's id and name, for filter menus. */
export const options = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orgs = await ctx.db.query("organizations").collect();
    return orgs
      .map((org) => ({ clerkOrgId: org.clerkOrgId, name: org.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const org = await ctx.db.get(args.id);
    if (!org) return null;

    const members = await Promise.all(
      org.members.map(async (clerkId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
          .first();
        return {
          clerkId,
          user: user
            ? { _id: user._id, name: user.name, email: user.email, imageUrl: user.imageUrl }
            : null,
          isOrgAdmin: org.admins.includes(clerkId),
          isOwner: org.ownerId === clerkId,
        };
      })
    );

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_org_id", (q) => q.eq("orgId", org.clerkOrgId))
      .order("desc")
      .collect();

    return {
      ...org,
      members: members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || Number(b.isOrgAdmin) - Number(a.isOrgAdmin)),
      docCount: documents.length,
      documents: documents.slice(0, 20).map((d) => ({
        _id: d._id,
        title: d.title,
        slug: d.slug,
        status: d.status,
        updatedAt: d.updatedAt,
      })),
    };
  },
});
