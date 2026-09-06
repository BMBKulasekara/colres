import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireAdmin, requireUser } from "./lib/auth.js";

/**
 * Mirrors a Clerk organization into Convex.
 *
 * Only a member of the organization may write its row, so a client cannot
 * invent memberships for an org it does not belong to — which would otherwise
 * grant access to that org's documents.
 */
export const upsertOrganization = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.string(),
    admins: v.array(v.string()),
    members: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!(user.orgIds ?? []).includes(args.clerkOrgId)) {
      throw new Error("Forbidden: you are not a member of that organization");
    }

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        slug: args.slug,
        imageUrl: args.imageUrl,
        ownerId: args.ownerId,
        admins: args.admins,
        members: args.members,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("organizations", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      slug: args.slug,
      imageUrl: args.imageUrl,
      ownerId: args.ownerId,
      admins: args.admins,
      members: args.members,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getOrganizationByClerkId = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role !== "admin" && !(user.orgIds ?? []).includes(args.clerkOrgId)) {
      throw new Error("Forbidden: you are not a member of that organization");
    }

    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();
  },
});

export const getAllOrganizations = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("organizations").collect();
  },
});
