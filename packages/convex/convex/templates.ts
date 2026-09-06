import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel.js";
import { type QueryCtx, mutation, query } from "./_generated/server.js";
import { getUserOrNull, requireAdmin } from "./lib/auth.js";
import { slugify } from "./lib/templateContent.js";
import {
    bibToolValidator,
    citationStyleValidator,
    engineValidator,
    templateCategoryValidator,
} from "./schema.js";

/* -------------------------------------------------------------------------- */
/*  Shared validators                                                          */
/* -------------------------------------------------------------------------- */

const sectionValidator = v.object({
    key: v.string(),
    title: v.string(),
    required: v.boolean(),
    targetWords: v.optional(v.number()),
    maxWords: v.optional(v.number()),
    guidance: v.optional(v.string()),
});

const fieldValidator = v.object({
    key: v.string(),
    label: v.string(),
    type: v.union(
        v.literal("text"),
        v.literal("textarea"),
        v.literal("authors"),
        v.literal("keywords"),
        v.literal("date")
    ),
    required: v.boolean(),
    placeholder: v.string(),
    defaultValue: v.optional(v.string()),
    help: v.optional(v.string()),
});

const classOptionValidator = v.object({
    value: v.string(),
    label: v.string(),
    isDefault: v.optional(v.boolean()),
    group: v.optional(v.string()),
});

const licenseValidator = v.object({
    spdx: v.string(),
    url: v.string(),
    redistributable: v.boolean(),
    notes: v.optional(v.string()),
});

/** Attaches a resolvable thumbnail URL; storage ids are not directly usable. */
async function withThumbnailUrl(ctx: QueryCtx, template: Doc<"templates">) {
    return {
        ...template,
        thumbnailUrl: template.thumbnailId
            ? await ctx.storage.getUrl(template.thumbnailId)
            : null,
    };
}

/* -------------------------------------------------------------------------- */
/*  Gallery queries                                                            */
/* -------------------------------------------------------------------------- */

export const listCategories = query({
    args: {},
    handler: async (ctx) => {
        // Empty rather than an error while the profile row is still syncing on
        // first sign-in; the query re-runs once it exists.
        if (!(await getUserOrNull(ctx))) return [];

        const categories = await ctx.db.query("templateCategories").collect();
        return categories
            .filter((category) => category.isActive)
            .sort((a, b) => a.order - b.order);
    },
});

/**
 * Published templates for the gallery: global ones plus any belonging to the
 * caller's active organization.
 */
export const listTemplates = query({
    args: {
        category: v.optional(templateCategoryValidator),
        search: v.optional(v.string()),
        tag: v.optional(v.string()),
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await getUserOrNull(ctx);
        if (!user) return [];

        const published = await ctx.db
            .query("templates")
            .withIndex("by_status", (q) => q.eq("status", "published"))
            .collect();

        const orgId =
            args.orgId && (user.orgIds ?? []).includes(args.orgId) ? args.orgId : undefined;

        const search = args.search?.trim().toLowerCase();

        const visible = published
            .filter((template) => !template.orgId || template.orgId === orgId)
            .filter((template) => !args.category || template.category === args.category)
            .filter((template) => !args.tag || template.tags.includes(args.tag))
            .filter((template) => {
                if (!search) return true;
                const haystack = [
                    template.name,
                    template.description,
                    template.publisher ?? "",
                    template.documentClass,
                    ...template.tags,
                ]
                    .join(" ")
                    .toLowerCase();
                return haystack.includes(search);
            })
            .sort((a, b) => {
                if (a.featured !== b.featured) return a.featured ? -1 : 1;
                if (a.order !== b.order) return a.order - b.order;
                return a.name.localeCompare(b.name);
            });

        return await Promise.all(visible.map((template) => withThumbnailUrl(ctx, template)));
    },
});

export const getTemplateBySlug = query({
    args: { slug: v.string() },
    handler: async (ctx, args) => {
        const user = await getUserOrNull(ctx);
        if (!user) return null;

        const template = await ctx.db
            .query("templates")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (!template) return null;
        if (template.status !== "published") return null;
        if (template.orgId && !(user.orgIds ?? []).includes(template.orgId)) return null;

        return await withThumbnailUrl(ctx, template);
    },
});

export const getTemplateById = query({
    args: { id: v.id("templates") },
    handler: async (ctx, args) => {
        const user = await getUserOrNull(ctx);
        if (!user) return null;

        const template = await ctx.db.get(args.id);
        if (!template) return null;
        if (template.status !== "published" && user.role !== "admin") return null;
        if (template.orgId && !(user.orgIds ?? []).includes(template.orgId)) return null;
        return await withThumbnailUrl(ctx, template);
    },
});

/* -------------------------------------------------------------------------- */
/*  Admin queries and mutations                                                */
/* -------------------------------------------------------------------------- */

export const adminListTemplates = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const templates = await ctx.db.query("templates").collect();
        const sorted = templates.sort((a, b) => {
            if (a.category !== b.category) return a.category.localeCompare(b.category);
            return a.order - b.order;
        });
        return await Promise.all(sorted.map((template) => withThumbnailUrl(ctx, template)));
    },
});

export const adminGetTemplate = query({
    args: { id: v.id("templates") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const template = await ctx.db.get(args.id);
        if (!template) return null;
        return await withThumbnailUrl(ctx, template);
    },
});

export const adminListCategories = query({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        const categories = await ctx.db.query("templateCategories").collect();
        const templates = await ctx.db.query("templates").collect();

        return categories
            .sort((a, b) => a.order - b.order)
            .map((category) => ({
                ...category,
                templateCount: templates.filter((t) => t.category === category.slug).length,
            }));
    },
});

const templateWriteArgs = {
    name: v.string(),
    category: templateCategoryValidator,
    description: v.string(),
    tags: v.array(v.string()),
    thumbnailId: v.optional(v.id("_storage")),
    official: v.boolean(),
    publisher: v.optional(v.string()),
    content: v.string(),
    sections: v.array(sectionValidator),
    fields: v.array(fieldValidator),
    engine: engineValidator,
    bibTool: bibToolValidator,
    passes: v.number(),
    entryFile: v.string(),
    documentClass: v.string(),
    classOptions: v.array(classOptionValidator),
    requiredPackages: v.array(v.string()),
    latexSkeleton: v.optional(v.string()),
    citationStyle: citationStyleValidator,
    license: licenseValidator,
    status: v.union(v.literal("draft"), v.literal("published")),
    featured: v.boolean(),
    order: v.number(),
    orgId: v.optional(v.string()),
};

async function uniqueTemplateSlug(
    ctx: { db: QueryCtx["db"] },
    base: string,
    excludeId?: Doc<"templates">["_id"]
): Promise<string> {
    const root = slugify(base) || "template";
    let candidate = root;

    for (let attempt = 2; ; attempt++) {
        const taken = await ctx.db
            .query("templates")
            .withIndex("by_slug", (q) => q.eq("slug", candidate))
            .first();
        if (!taken || taken._id === excludeId) return candidate;
        candidate = `${root}-${attempt}`;
    }
}

export const adminCreateTemplate = mutation({
    args: {
        ...templateWriteArgs,
        slug: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx);
        const { slug: requestedSlug, ...rest } = args;

        const slug = await uniqueTemplateSlug(ctx, requestedSlug || rest.name);
        const now = Date.now();

        return await ctx.db.insert("templates", {
            ...rest,
            slug,
            version: 1,
            usageCount: 0,
            createdBy: admin._id,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const adminUpdateTemplate = mutation({
    args: {
        id: v.id("templates"),
        slug: v.optional(v.string()),
        name: v.optional(v.string()),
        category: v.optional(templateCategoryValidator),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        thumbnailId: v.optional(v.id("_storage")),
        official: v.optional(v.boolean()),
        publisher: v.optional(v.string()),
        content: v.optional(v.string()),
        sections: v.optional(v.array(sectionValidator)),
        fields: v.optional(v.array(fieldValidator)),
        engine: v.optional(engineValidator),
        bibTool: v.optional(bibToolValidator),
        passes: v.optional(v.number()),
        entryFile: v.optional(v.string()),
        documentClass: v.optional(v.string()),
        classOptions: v.optional(v.array(classOptionValidator)),
        requiredPackages: v.optional(v.array(v.string())),
        latexSkeleton: v.optional(v.string()),
        citationStyle: v.optional(citationStyleValidator),
        license: v.optional(licenseValidator),
        status: v.optional(v.union(v.literal("draft"), v.literal("published"))),
        featured: v.optional(v.boolean()),
        order: v.optional(v.number()),
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const { id, ...updates } = args;

        const existing = await ctx.db.get(id);
        if (!existing) {
            throw new Error("Template not found");
        }

        // Only forward keys the caller actually sent, so an omitted field is
        // left alone rather than being cleared.
        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) patch[key] = value;
        }

        if (typeof patch.slug === "string") {
            patch.slug = await uniqueTemplateSlug(ctx, patch.slug, id);
        }

        // Bump the version whenever the seeded body or the compilation
        // contract changes, so documents keep a truthful provenance record.
        const contractKeys = [
            "content",
            "latexSkeleton",
            "engine",
            "bibTool",
            "documentClass",
            "classOptions",
            "citationStyle",
            "sections",
            "fields",
        ];
        const contractChanged = contractKeys.some((key) => key in patch);

        await ctx.db.patch(id, {
            ...patch,
            version: contractChanged ? existing.version + 1 : existing.version,
            updatedAt: Date.now(),
        });

        return await ctx.db.get(id);
    },
});

export const adminSetTemplateStatus = mutation({
    args: {
        id: v.id("templates"),
        status: v.union(v.literal("draft"), v.literal("published")),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const template = await ctx.db.get(args.id);
        if (!template) {
            throw new Error("Template not found");
        }
        await ctx.db.patch(args.id, { status: args.status, updatedAt: Date.now() });
        return await ctx.db.get(args.id);
    },
});

export const adminDuplicateTemplate = mutation({
    args: { id: v.id("templates") },
    handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx);
        const source = await ctx.db.get(args.id);
        if (!source) {
            throw new Error("Template not found");
        }

        const { _id, _creationTime, ...copy } = source;
        const now = Date.now();

        return await ctx.db.insert("templates", {
            ...copy,
            name: `${source.name} (copy)`,
            slug: await uniqueTemplateSlug(ctx, `${source.slug}-copy`),
            // A copy starts unpublished and un-featured so it cannot silently
            // appear in the gallery alongside its original.
            status: "draft",
            featured: false,
            version: 1,
            usageCount: 0,
            createdBy: admin._id,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const adminDeleteTemplate = mutation({
    args: { id: v.id("templates") },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const template = await ctx.db.get(args.id);
        if (!template) {
            throw new Error("Template not found");
        }

        // Documents keep `templateSnapshot`, so they survive the deletion with
        // their contract intact; only the dangling reference is cleared.
        const derived = await ctx.db.query("documents").collect();
        for (const doc of derived) {
            if (doc.templateId === args.id) {
                await ctx.db.patch(doc._id, { templateId: undefined });
            }
        }

        if (template.thumbnailId) {
            await ctx.storage.delete(template.thumbnailId);
        }
        await ctx.db.delete(args.id);
        return template;
    },
});

export const adminUpsertCategory = mutation({
    args: {
        slug: templateCategoryValidator,
        name: v.string(),
        description: v.optional(v.string()),
        icon: v.optional(v.string()),
        order: v.number(),
        isActive: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        const existing = await ctx.db
            .query("templateCategories")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (existing) {
            await ctx.db.patch(existing._id, args);
            return existing._id;
        }
        return await ctx.db.insert("templateCategories", args);
    },
});

/** Upload URL for a gallery thumbnail. Admin-only, single-use. */
export const adminGenerateThumbnailUploadUrl = mutation({
    args: {},
    handler: async (ctx) => {
        await requireAdmin(ctx);
        return await ctx.storage.generateUploadUrl();
    },
});
