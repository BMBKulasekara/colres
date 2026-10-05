import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { internalMutation, mutation, query } from "./_generated/server.js";
import { canAccessDocument, getUserOrNull, requireUser } from "./lib/auth.js";
import { NOTIFICATION_RETENTION_MS } from "./lib/notify.js";

/** How many the bell's list shows. */
const LIST_LIMIT = 30;

/** Unread counts above this show as "99+". */
const COUNT_CAP = 99;

/** Rows one clean-up run deletes before scheduling the next. */
const PRUNE_BATCH = 500;

/**
 * The caller's most recent notifications, newest first, with the document's
 * title and link. Ones for documents they can no longer open are left out.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserOrNull(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(LIST_LIMIT);

    const results = [];
    for (const row of rows) {
      const document = await ctx.db.get(row.documentId);
      if (!document || !(await canAccessDocument(ctx, document, user, "view"))) continue;
      results.push({ ...row, documentTitle: document.title, documentSlug: document.slug });
    }
    return results;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getUserOrNull(ctx);
    if (!user) return 0;
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .take(COUNT_CAP + 1);
    return unread.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== user._id || row.readAt) return;
    await ctx.db.patch(id, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .collect();
    const now = Date.now();
    for (const row of unread) await ctx.db.patch(row._id, { readAt: now });
  },
});

/** Cron: deletes notifications older than 90 days. */
export const _pruneOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = await ctx.db
      .query("notifications")
      .withIndex("by_created", (q) => q.lt("createdAt", Date.now() - NOTIFICATION_RETENTION_MS))
      .take(PRUNE_BATCH);
    for (const row of old) await ctx.db.delete(row._id);
    if (old.length === PRUNE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.notifications._pruneOld, {});
    }
  },
});
