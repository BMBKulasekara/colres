import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireAdmin, requireCallerClerkId } from "./lib/auth.js";

/**
 * Look up a user profile.
 *
 * Callers may read their own row; reading anyone else's requires admin. The
 * admin dashboard uses this to check the signed-in user's own role, which is
 * why the self case must work before any admin check.
 */
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const callerClerkId = await requireCallerClerkId(ctx);

    if (args.clerkId !== callerClerkId) {
      await requireAdmin(ctx);
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
  },
});

export const getAllUsers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const editAdmin = mutation({
  args: {
    clerkId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existing) {
      throw new Error("User not found");
    }

    // Without this an admin can demote themselves and lock everyone out of the
    // dashboard, since role is the only way back in.
    if (existing._id === admin._id && args.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }

    await ctx.db.patch(existing._id, { role: args.role });
    return { success: true, msg: "Admin role changed successfully" };
  },
});

export const updateUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!existing) {
      throw new Error("User not found");
    }

    if (existing._id === admin._id && args.role !== "admin") {
      throw new Error("You cannot remove your own admin role");
    }

    await ctx.db.patch(existing._id, {
      name: args.name,
      email: args.email,
      role: args.role,
    });

    return { success: true, msg: "User details updated successfully" };
  },
});

/**
 * Mirrors the signed-in user's Clerk profile into Convex on login.
 *
 * The identity comes from the verified token, so a caller can only ever write
 * their own row. `role` is deliberately not an argument: it used to be, which
 * meant any client could grant itself "admin" simply by passing it here.
 */
export const upsert = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkId = await requireCallerClerkId(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? "",
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      name: args.name,
      email: args.email,
      imageUrl: args.imageUrl ?? "",
      role: "user",
      createdAt: Date.now(),
    });
  },
});

export const syncUserOrganizations = mutation({
  args: {
    orgIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkId = await requireCallerClerkId(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();

    if (!existing) {
      throw new Error("User not found");
    }

    await ctx.db.patch(existing._id, { orgIds: args.orgIds });
    return existing._id;
  },
});
