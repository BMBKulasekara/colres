import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel.js";
import { type QueryCtx, mutation, query } from "../_generated/server.js";
import { RESERVED_SLUGS, isValidSlug } from "../documents.js";
import { logAudit } from "../lib/audit.js";
import { requireAdmin } from "../lib/auth.js";
import { cascadeDeleteDocument, countDocumentDependents } from "../lib/cascade.js";

/** Bulk operations cap: each delete cascades, so keep a transaction bounded. */
const MAX_BULK = 50;

/**
 * A list row: the document without its body (which can be large and is never
 * shown in a table), plus the names the table displays.
 */
async function toRow(ctx: QueryCtx, doc: Doc<"documents">) {
  const { content: _content, templateSnapshot: _snapshot, ...rest } = doc;
  const [author, template, org] = await Promise.all([
    ctx.db.get(doc.author),
    doc.templateId ? ctx.db.get(doc.templateId) : null,
    doc.orgId
      ? ctx.db
          .query("organizations")
          .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", doc.orgId as string))
          .first()
      : null,
  ]);
  return {
    ...rest,
    author: author
      ? { _id: author._id, name: author.name, email: author.email, imageUrl: author.imageUrl }
      : null,
    template: template ? { _id: template._id, name: template.name } : null,
    organization: org ? { _id: org._id, name: org.name } : null,
  };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    q: v.optional(v.string()),
    status: v.optional(v.boolean()),
    orgId: v.optional(v.string()),
    authorId: v.optional(v.id("users")),
    templateId: v.optional(v.id("templates")),
    sort: v.optional(v.union(v.literal("updated"), v.literal("created"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = args.q?.trim();

    if (search) {
      const page = await ctx.db
        .query("documents")
        .withSearchIndex("search_title", (s) => {
          let filtered = s.search("title", search);
          if (args.status !== undefined) filtered = filtered.eq("status", args.status);
          if (args.orgId) filtered = filtered.eq("orgId", args.orgId);
          if (args.authorId) filtered = filtered.eq("author", args.authorId);
          if (args.templateId) filtered = filtered.eq("templateId", args.templateId);
          return filtered;
        })
        .paginate(args.paginationOpts);
      return { ...page, page: await Promise.all(page.page.map((doc) => toRow(ctx, doc))) };
    }

    const base =
      args.sort === "created"
        ? ctx.db.query("documents").withIndex("by_created").order("desc")
        : args.status !== undefined
          ? ctx.db
              .query("documents")
              .withIndex("by_status_updated", (q) => q.eq("status", args.status as boolean))
              .order("desc")
          : ctx.db.query("documents").withIndex("by_updated").order("desc");

    const needsStatusFilter = args.sort === "created" && args.status !== undefined;
    const hasFilters = needsStatusFilter || args.orgId || args.authorId || args.templateId;

    const filtered = hasFilters
      ? base.filter((f) =>
          f.and(
            needsStatusFilter ? f.eq(f.field("status"), args.status as boolean) : true,
            args.orgId ? f.eq(f.field("orgId"), args.orgId) : true,
            args.authorId ? f.eq(f.field("author"), args.authorId) : true,
            args.templateId ? f.eq(f.field("templateId"), args.templateId) : true
          )
        )
      : base;

    const page = await filtered.paginate(args.paginationOpts);
    return { ...page, page: await Promise.all(page.page.map((doc) => toRow(ctx, doc))) };
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const doc = await ctx.db.get(args.id);
    if (!doc) return null;
    const [row, dependents] = await Promise.all([
      toRow(ctx, doc),
      countDocumentDependents(ctx, doc._id),
    ]);
    return {
      ...row,
      content: doc.content,
      templateVersion: doc.templateVersion,
      templateSnapshot: doc.templateSnapshot,
      dependents,
    };
  },
});

export const checkSlug = query({
  args: { slug: v.string(), excludeId: v.optional(v.id("documents")) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = args.slug.trim();
    if (!isValidSlug(slug)) {
      return { valid: false, available: false, reason: "Use lowercase letters, numbers and hyphens" };
    }
    if (RESERVED_SLUGS.has(slug)) {
      return { valid: false, available: false, reason: "This slug is reserved" };
    }
    const taken = await ctx.db
      .query("documents")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    const available = !taken || taken._id === args.excludeId;
    return { valid: true, available, reason: available ? undefined : "Already in use" };
  },
});

function assertBulkSize(ids: Id<"documents">[]) {
  if (ids.length === 0) throw new Error("No documents selected");
  if (ids.length > MAX_BULK) {
    throw new Error(`Select at most ${MAX_BULK} documents at a time`);
  }
}

export const bulkSetStatus = mutation({
  args: { ids: v.array(v.id("documents")), status: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    let changed = 0;
    const now = Date.now();
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (!doc || doc.status === args.status) continue;
      await ctx.db.patch(id, { status: args.status, updatedAt: now });
      changed++;
    }

    if (changed > 0) {
      await logAudit(ctx, admin, {
        action: args.status ? "document.bulk_activate" : "document.bulk_draft",
        entityType: "document",
        entityLabel: `${changed} document${changed === 1 ? "" : "s"}`,
        meta: { count: changed, ids: args.ids },
      });
    }
    return { changed };
  },
});

export const bulkDelete = mutation({
  args: { ids: v.array(v.id("documents")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const titles: string[] = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (!doc) continue;
      await cascadeDeleteDocument(ctx, id);
      titles.push(doc.title);
    }

    if (titles.length > 0) {
      await logAudit(ctx, admin, {
        action: "document.bulk_delete",
        entityType: "document",
        entityLabel: `${titles.length} document${titles.length === 1 ? "" : "s"}`,
        meta: { count: titles.length, titles: titles.slice(0, 20) },
      });
    }
    return { deleted: titles.length };
  },
});
