import { v } from "convex/values";
import { type MutationCtx, internalMutation, mutation } from "./_generated/server.js";
import { requireAdmin } from "./lib/auth.js";
import { templateCatalog } from "./lib/templateCatalog.js";

/**
 * Copies the checked-in catalog into the database.
 *
 * Idempotent and keyed by slug, so it is safe to re-run after adding a
 * template to the catalog. By default it will NOT overwrite a template an
 * admin has since edited; pass `overwrite: true` to force the catalog version
 * back in, which discards those edits.
 *
 * Run from the CLI:
 *   npx convex run seedTemplates:seed
 *   npx convex run seedTemplates:seed '{"overwrite": true}'
 */
async function runSeed(ctx: MutationCtx, overwrite: boolean) {
    const result = {
        categoriesCreated: 0,
        categoriesUpdated: 0,
        templatesCreated: 0,
        templatesUpdated: 0,
        templatesSkipped: 0,
    };

    for (const category of templateCatalog.categories) {
        const existing = await ctx.db
            .query("templateCategories")
            .withIndex("by_slug", (q) => q.eq("slug", category.slug))
            .first();

        if (existing) {
            // Names and ordering are safe to refresh; `isActive` is left alone
            // because an admin may have deliberately hidden a category.
            await ctx.db.patch(existing._id, {
                name: category.name,
                description: category.description,
                icon: category.icon,
                order: category.order,
            });
            result.categoriesUpdated++;
        } else {
            await ctx.db.insert("templateCategories", category);
            result.categoriesCreated++;
        }
    }

    const now = Date.now();

    for (const template of templateCatalog.templates) {
        const existing = await ctx.db
            .query("templates")
            .withIndex("by_slug", (q) => q.eq("slug", template.slug))
            .first();

        if (!existing) {
            await ctx.db.insert("templates", {
                ...template,
                status: "published",
                version: 1,
                usageCount: 0,
                createdAt: now,
                updatedAt: now,
            });
            result.templatesCreated++;
            continue;
        }

        if (!overwrite) {
            result.templatesSkipped++;
            continue;
        }

        await ctx.db.patch(existing._id, {
            ...template,
            // Preserve operational state that belongs to the deployment, not
            // to the catalog.
            status: existing.status,
            usageCount: existing.usageCount,
            version: existing.version + 1,
            updatedAt: now,
        });
        result.templatesUpdated++;
    }

    return result;
}

/** For `npx convex run`, which has no signed-in identity. */
export const seed = internalMutation({
    args: { overwrite: v.optional(v.boolean()) },
    handler: async (ctx, args) => runSeed(ctx, args.overwrite ?? false),
});

/** Same seed, callable from the admin panel by a signed-in admin. */
export const adminReseedCatalog = mutation({
    args: { overwrite: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);
        return await runSeed(ctx, args.overwrite ?? false);
    },
});
