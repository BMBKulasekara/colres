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

});
