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
  tasks: defineTable({
    text: v.string(),
    isCompleted: v.boolean(),
  }),
});
