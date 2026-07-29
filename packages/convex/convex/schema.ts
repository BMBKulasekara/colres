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
  }).index("by_clerk_id", ["clerkId"]),


  documents: defineTable({
    author: v.id("users"),
    title: v.string(),
    slug: v.string(),
    status: v.boolean(),
    content: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_author", ["author"]),

});
