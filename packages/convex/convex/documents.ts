import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

export const createDocument = mutation({
    args: {
        title: v.string(),
        slug: v.string(),
        content: v.string(),
        status: v.boolean(),
        clerkId: v.string(),
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db.query("users").filter(
            (q) => q.eq(q.field("clerkId"), args.clerkId)
        ).first();
        if (!user) {
            throw new Error("User not found");
        }

        const existingDocument = await ctx.db.query("documents").filter(
            (q) => q.eq(q.field("title"), args.title)
        ).first();
        if (existingDocument) {
            throw new Error("Document already exists");
        }
        const document = await ctx.db.insert("documents", {
            title: args.title,
            slug: args.slug,
            content: args.content,
            status: args.status,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            author: user._id,
            orgId: args.orgId,
        });
        return document;
    }
})

export const getDocument = query({
    args: {
        slug: v.string(),
    },
    handler: async (ctx, args) => {
        const document = await ctx.db.query("documents").filter(
            (q) => q.eq(q.field("slug"), args.slug)
        ).first();
        return document;
    }
})

export const updateDocument = mutation({
    args: {
        id: v.id("documents"),
        title: v.optional(v.string()),
        slug: v.optional(v.string()),
        content: v.optional(v.string()),
        status: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;

        const document = await ctx.db.get(id);
        if (!document) {
            throw new Error("Document not found");
        }

        await ctx.db.patch(id, {
            ...updates,
            updatedAt: Date.now(),
        });

        return document;
    }
})

export const getAllDocumentsByUserId = query({
    args: {
        clerkId: v.string(),
        orgId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
            .first();

        if (!user) {
            return [];
        }

        if (args.orgId) {
            const documents = await ctx.db
                .query("documents")
                .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
                .collect();
            return documents;
        } else {
            const documents = await ctx.db
                .query("documents")
                .withIndex("by_author", (q) => q.eq("author", user._id))
                .collect();
            return documents.filter((doc) => !doc.orgId);
        }
    }
})
export const deleteDocumentById = mutation({
    args: {
        id: v.id("documents"),
    },
    handler: async (ctx, args) => {
        const document = await ctx.db.get(args.id);
        if (!document) {
            throw new Error("Document not found");
        }

        await ctx.db.delete(args.id);
        return document;
    }
})

export const getDocumentsByOrgId = query({
    args: {
        orgId: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("documents")
            .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
            .collect();
    }
});

export const getAllDocuments = query({
    handler: async (ctx) => {
        const documents = await ctx.db.query("documents").collect();
        return await Promise.all(
            documents.map(async (doc) => {
                const author = await ctx.db.get(doc.author);
                return {
                    ...doc,
                    authorName: author ? author.name : "Unknown User",
                    authorEmail: author ? author.email : "",
                };
            })
        );
    }
});