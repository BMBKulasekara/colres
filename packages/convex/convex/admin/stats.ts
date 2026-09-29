import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server.js";
import { query } from "../_generated/server.js";
import { requireAdmin } from "../lib/auth.js";

/*
 * Dashboard numbers.
 *
 * Totals are counted by reading the tables. That is fine at the current scale
 * (thousands of rows); past that, swap the counting for the
 * `@convex-dev/aggregate` component or a counters table maintained in the same
 * mutations. The return shapes here do not need to change when that happens.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const rangeValidator = v.union(v.literal("7d"), v.literal("30d"), v.literal("90d"));
type Range = "7d" | "30d" | "90d";

function rangeDays(range: Range): number {
  return range === "7d" ? 7 : range === "30d" ? 30 : 90;
}

/** Midnight UTC at the start of the window, so buckets line up with dates. */
function windowStart(now: number, days: number): number {
  const today = Math.floor(now / DAY_MS) * DAY_MS;
  return today - (days - 1) * DAY_MS;
}

function bucketByDay(timestamps: number[], start: number, days: number): number[] {
  const buckets = new Array<number>(days).fill(0);
  for (const ts of timestamps) {
    const index = Math.floor((ts - start) / DAY_MS);
    if (index >= 0 && index < days) buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

async function createdSince(
  ctx: QueryCtx,
  table: "users" | "documents" | "organizations",
  since: number
): Promise<number[]> {
  const rows = await ctx.db
    .query(table)
    .withIndex("by_created", (q) => q.gte("createdAt", since))
    .collect();
  return rows.map((row) => row.createdAt);
}

export const overview = query({
  args: { range: rangeValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const days = rangeDays(args.range);
    const now = Date.now();
    const start = windowStart(now, days);
    const previousStart = start - days * DAY_MS;

    const [users, documents, organizations, templates] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("organizations").collect(),
      ctx.db.query("templates").collect(),
    ]);

    const [userTimes, documentTimes, orgTimes] = await Promise.all([
      createdSince(ctx, "users", previousStart),
      createdSince(ctx, "documents", previousStart),
      createdSince(ctx, "organizations", previousStart),
    ]);

    const split = (times: number[]) => ({
      current: times.filter((t) => t >= start).length,
      previous: times.filter((t) => t < start).length,
    });

    return {
      range: args.range,
      totals: {
        users: users.length,
        admins: users.filter((u) => u.role === "admin").length,
        documents: documents.length,
        activeDocuments: documents.filter((d) => d.status).length,
        organizations: organizations.length,
        publishedTemplates: templates.filter((t) => t.status === "published").length,
        draftTemplates: templates.filter((t) => t.status === "draft").length,
      },
      periods: {
        users: split(userTimes),
        documents: split(documentTimes),
        organizations: split(orgTimes),
      },
      sparklines: {
        users: bucketByDay(userTimes, start, days),
        documents: bucketByDay(documentTimes, start, days),
        organizations: bucketByDay(orgTimes, start, days),
      },
    };
  },
});

export const timeseries = query({
  args: { range: rangeValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const days = rangeDays(args.range);
    const start = windowStart(Date.now(), days);

    const [userTimes, documentTimes] = await Promise.all([
      createdSince(ctx, "users", start),
      createdSince(ctx, "documents", start),
    ]);
    const users = bucketByDay(userTimes, start, days);
    const documents = bucketByDay(documentTimes, start, days);

    return users.map((count, index) => ({
      date: new Date(start + index * DAY_MS).toISOString().slice(0, 10),
      users: count,
      documents: documents[index] ?? 0,
    }));
  },
});

export const topTemplates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const templates = await ctx.db.query("templates").collect();
    return templates
      .filter((t) => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, Math.min(args.limit ?? 5, 20))
      .map((t) => ({ _id: t._id, name: t.name, usageCount: t.usageCount, status: t.status }));
  },
});

/** The small numbers shown beside sidebar items. */
export const navCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [users, documents, organizations, drafts] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("documents").collect(),
      ctx.db.query("organizations").collect(),
      ctx.db
        .query("templates")
        .withIndex("by_status", (q) => q.eq("status", "draft"))
        .collect(),
    ]);
    return {
      users: users.length,
      documents: documents.length,
      organizations: organizations.length,
      draftTemplates: drafts.length,
    };
  },
});
