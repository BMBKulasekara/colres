import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel.js";
import { type MutationCtx, mutation, query } from "./_generated/server.js";
import {
    canAccessDocument,
    getUserOrNull,
    requireAdmin,
    requireDocumentAccess,
    requireDocumentAccessByRef,
    requireUser,
} from "./lib/auth.js";
import { logAudit } from "./lib/audit.js";
import { cascadeDeleteDocument } from "./lib/cascade.js";
import { applyFieldValues, slugify } from "./lib/templateContent.js";
import { citationStyleValidator } from "./schema.js";

/**
 * Slugs that would shadow a real route under /docs/. `/docs/templates` is a
 * static page, and Next.js resolves static segments before the dynamic
 * `[editor]` one, so a document with that slug would be unreachable.
 */
export const RESERVED_SLUGS = new Set(["templates", "new", "settings"]);

/** Lowercase letters, digits and single hyphens between them. */
export function isValidSlug(slug: string): boolean {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Slugs address documents in the URL, so they must be globally unique.
 * Previously the client built the slug from the author's first name plus the
 * title, which collided whenever two users picked the same title -- and
 * `getDocument` would then return whichever row it found first, exposing
 * someone else's document. The slug is now derived server-side and
 * disambiguated with a numeric suffix.
 */

async function uniqueSlug(ctx: MutationCtx, base: string): Promise<string> {
    let root = slugify(base) || "untitled-document";
    if (RESERVED_SLUGS.has(root)) {
        root = `${root}-doc`;
    }

    let candidate = root;
    for (let attempt = 2; ; attempt++) {
        const taken = await ctx.db
            .query("documents")
            .withIndex("by_slug", (q) => q.eq("slug", candidate))
            .first();
        if (!taken) return candidate;
        candidate = `${root}-${attempt}`;
    }
}

export const createDocument = mutation({
    args: {
        title: v.string(),
        content: v.optional(v.string()),
        status: v.optional(v.boolean()),
        orgId: v.optional(v.string()),
        description: v.optional(v.string()),
        /** Omit for a blank document. */
        templateId: v.optional(v.id("templates")),
        /** Values for the template's `fields`, keyed by field key. */
        fieldValues: v.optional(v.record(v.string(), v.string())),
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);

        if (args.orgId && !(user.orgIds ?? []).includes(args.orgId)) {
            throw new Error("Forbidden: you are not a member of that organization");
        }

        const title = args.title.trim() || "Untitled Document";
        const slug = await uniqueSlug(ctx, title);

        let content = args.content ?? "";
        let templateVersion: number | undefined;
        let templateSnapshot: Doc<"documents">["templateSnapshot"];

        if (args.templateId) {
            const template = await ctx.db.get(args.templateId);
            if (!template) {
                throw new Error("Template not found");
            }
            if (template.status !== "published") {
                throw new Error("Template is not published");
            }
            if (template.orgId && template.orgId !== args.orgId) {
                throw new Error("Forbidden: that template belongs to another organization");
            }

            // Substitute the wizard's answers into the skeleton's {{TOKENS}}.
            content = applyFieldValues(template.content, template.fields, {
                ...(args.fieldValues ?? {}),
                title,
            });

            templateVersion = template.version;
            templateSnapshot = {
                slug: template.slug,
                name: template.name,
                engine: template.engine,
                bibTool: template.bibTool,
                documentClass: template.documentClass,
                classOptions: template.classOptions
                    .filter((option) => option.isDefault)
                    .map((option) => option.value),
                citationStyle: template.citationStyle,
            };

            await ctx.db.patch(template._id, {
                usageCount: template.usageCount + 1,
            });
        }

        const now = Date.now();
        const documentId = await ctx.db.insert("documents", {
            title,
            slug,
            content,
            status: args.status ?? true,
            createdAt: now,
            updatedAt: now,
            author: user._id,
            orgId: args.orgId,
            description: args.description,
            templateId: args.templateId,
            templateVersion,
            templateSnapshot,
        });

        // The caller needs the resolved slug to navigate, since it may have
        // been suffixed to avoid a collision.
        return { id: documentId, slug };
    },
});

export const getDocument = query({
    args: {
        slug: v.string(),
    },
    handler: async (ctx, args) => {
        // Null rather than an error while the profile row is still syncing;
        // the query re-runs on its own once it exists.
        const user = await getUserOrNull(ctx);
        if (!user) return null;

        const document = await ctx.db
            .query("documents")
            .withIndex("by_slug", (q) => q.eq("slug", args.slug))
            .first();

        if (!document) return null;
        if (!(await canAccessDocument(ctx, document, user))) return null;
        return document;
    },
});

export const getDocumentById = query({
    args: {
        id: v.id("documents"),
    },
    handler: async (ctx, args) => {
        const user = await getUserOrNull(ctx);
        if (!user) return null;

        const document = await ctx.db.get(args.id);
        if (!document) return null;
        if (!(await canAccessDocument(ctx, document, user))) return null;
        return document;
    },
});

export const updateDocument = mutation({
    args: {
        id: v.id("documents"),
        title: v.optional(v.string()),
        content: v.optional(v.string()),
        status: v.optional(v.boolean()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const { document } = await requireDocumentAccess(ctx, id);

        await ctx.db.patch(id, {
            ...updates,
            updatedAt: Date.now(),
        });

        return document;
    },
});

/**
 * Chooses the citation style for a document — APA, IEEE, Harvard, MLA and so
 * on. Every collaborator sees the change at once: the in-text citations and
 * the reference list are both drawn from it.
 */
export const setCitationStyle = mutation({
    args: {
        id: v.id("documents"),
        citationStyle: citationStyleValidator,
    },
    handler: async (ctx, args) => {
        await requireDocumentAccess(ctx, args.id);
        await ctx.db.patch(args.id, {
            citationStyle: args.citationStyle,
            updatedAt: Date.now(),
        });
    },
});

export const getAllDocumentsByUserId = query({
    args: {
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // An empty list is the honest answer while the profile row is still
        // being created on first sign-in.
        const user = await getUserOrNull(ctx);
        if (!user) return [];

        if (args.orgId) {
            if (!(user.orgIds ?? []).includes(args.orgId)) {
                return [];
            }
            return await ctx.db
                .query("documents")
                .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
                .collect();
        }

        const documents = await ctx.db
            .query("documents")
            .withIndex("by_author", (q) => q.eq("author", user._id))
            .collect();
        return documents.filter((doc) => !doc.orgId);
    },
});

export const deleteDocumentById = mutation({
    args: {
        id: v.id("documents"),
    },
    handler: async (ctx, args) => {
        const { document } = await requireDocumentAccess(ctx, args.id);
        await cascadeDeleteDocument(ctx, args.id);
        return document;
    },
});

/**
 * Admin-only delete. Admins are not necessarily members of the owning org, so
 * this bypasses the ownership check that `deleteDocumentById` applies.
 */
export const adminDeleteDocument = mutation({
    args: {
        id: v.id("documents"),
    },
    handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx);
        const document = await ctx.db.get(args.id);
        if (!document) {
            throw new Error("Document not found");
        }
        await cascadeDeleteDocument(ctx, args.id);
        await logAudit(ctx, admin, {
            action: "document.delete",
            entityType: "document",
            entityId: args.id,
            entityLabel: document.title,
        });
        return document;
    },
});

export const adminUpdateDocument = mutation({
    args: {
        id: v.id("documents"),
        title: v.optional(v.string()),
        slug: v.optional(v.string()),
        content: v.optional(v.string()),
        status: v.optional(v.boolean()),
        description: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const admin = await requireAdmin(ctx);
        const { id, ...updates } = args;

        const document = await ctx.db.get(id);
        if (!document) {
            throw new Error("Document not found");
        }

        if (updates.title !== undefined && !updates.title.trim()) {
            throw new Error("Title cannot be empty");
        }

        if (updates.slug !== undefined && updates.slug !== document.slug) {
            if (!isValidSlug(updates.slug)) {
                throw new Error("Slugs may only contain lowercase letters, numbers and hyphens");
            }
            if (RESERVED_SLUGS.has(updates.slug)) {
                throw new Error(`"${updates.slug}" is reserved and cannot be used as a slug`);
            }
            const clash = await ctx.db
                .query("documents")
                .withIndex("by_slug", (q) => q.eq("slug", updates.slug as string))
                .first();
            if (clash) {
                throw new Error(`Slug "${updates.slug}" is already in use`);
            }
        }

        await ctx.db.patch(id, { ...updates, updatedAt: Date.now() });

        const changed = Object.entries(updates)
            .filter(([key, value]) => value !== undefined && value !== document[key as keyof typeof document])
            .map(([key]) => key);
        if (changed.length > 0) {
            await logAudit(ctx, admin, {
                action:
                    changed.length === 1 && changed[0] === "status"
                        ? updates.status
                            ? "document.activate"
                            : "document.draft"
                        : "document.update",
                entityType: "document",
                entityId: id,
                entityLabel: updates.title ?? document.title,
                meta: { fields: changed },
            });
        }
        return await ctx.db.get(id);
    },
});

export const getDocumentsByOrgId = query({
    args: {
        orgId: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx);
        if (!(user.orgIds ?? []).includes(args.orgId)) {
            throw new Error("Forbidden: you are not a member of that organization");
        }
        return await ctx.db
            .query("documents")
            .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
            .collect();
    },
});

/**
 * A served URL for a file already uploaded to storage.
 *
 * A storage id is not fetchable on its own — only the server can mint a URL
 * for it — so an image placed in a figure has to come back through here before
 * the document can reference it.
 *
 * The URL is written into the document rather than resolved on every render,
 * which is what makes the figure survive a print, an export, or being read by
 * anything that is not this app. Convex file URLs do not expire.
 */
export const resolveUploadUrl = mutation({
    args: { documentId: v.string(), storageId: v.id("_storage") },
    handler: async (ctx, args) => {
        await requireDocumentAccessByRef(ctx, args.documentId);
        return await ctx.storage.getUrl(args.storageId);
    },
});
