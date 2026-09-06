import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.string(),
    role: v.string(),
    createdAt: v.number(),
    orgIds: v.optional(v.array(v.string())),
  }).index("by_clerk_id", ["clerkId"]),


  documents: defineTable({
    author: v.id("users"),
    orgId: v.optional(v.string()),
    title: v.string(),
    slug: v.string(),
    status: v.boolean(),
    content: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["author"])
    .index("by_org_id", ["orgId"]),


  organizations: defineTable({
    clerkOrgId: v.string(),
    name: v.string(),
    slug: v.string(),
    imageUrl: v.optional(v.string()),
    ownerId: v.string(),
    admins: v.array(v.string()),
    members: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_org_id", ["clerkOrgId"]),

  chats: defineTable({
    documentId: v.id("documents"),
    text: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.string(),
    createdAt: v.number(),
  }).index("by_document_id", ["documentId"]),

  paperSuggestions: defineTable({
    documentId: v.id("documents"),
    // Hash of the title + description the suggestions were generated from, so
    // the UI can tell the author when their context has drifted.
    contextHash: v.string(),
    queries: v.array(v.string()),
    papers: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        url: v.string(),
        abstract: v.string(),
        authors: v.array(v.string()),
        year: v.number(),
        citationCount: v.number(),
        venue: v.optional(v.string()),
        doi: v.optional(v.string()),
        openAccessUrl: v.optional(v.string()),
        // One line from the model on why this paper fits the document.
        reason: v.string(),
        status: v.union(
          v.literal("suggested"),
          v.literal("saved"),
          v.literal("dismissed")
        ),
      })
    ),
    generatedAt: v.number(),
  }).index("by_document_id", ["documentId"]),

  comments: defineTable({
    documentId: v.id("documents"),
    threadId: v.string(),
    commentId: v.string(),
    text: v.string(),
    senderId: v.string(),
    senderName: v.string(),
    senderAvatar: v.string(),
    createdAt: v.number(),
  }).index("by_document_id", ["documentId"])
    .index("by_thread_id", ["threadId"]),

});
