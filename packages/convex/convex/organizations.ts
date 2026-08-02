import { mutation, query } from "./_generated/server.js";
import { v } from "convex/values";

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

    const orgId = await ctx.db.insert("organizations", {
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
    return orgId;
  },
});

export const getOrganizationByClerkId = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizations")
      .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();
  },
});

export const getAllOrganizations = query({
  handler: async (ctx) => {
    return await ctx.db.query("organizations").collect();
  },
});
