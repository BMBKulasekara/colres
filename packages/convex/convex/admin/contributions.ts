import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { requireAdmin } from "../lib/auth.js";
import { summarizeDocument } from "../lib/contributions.js";

/** Contribution breakdown for any document, for the admin console. */
export const forDocument = query({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await summarizeDocument(ctx, args.documentId);
  },
});
