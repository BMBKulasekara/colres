import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server.js";
import { collaboratorIds } from "./chats.js";
import { isInTrash, requireDocumentAccess } from "./lib/auth.js";
import {
  cleanSectionTargets,
  cleanWordTarget,
  deadlineLabel,
  reminderWindows,
} from "./lib/goalPolicy.js";
import { notify, usersByClerkIds } from "./lib/notify.js";

/** At most one deadline reminder per document within this long. */
const REMINDER_GAP_MS = 20 * 60 * 60 * 1000;

/**
 * Writing goals: a word target, per-section targets and a deadline for a
 * document, set by anyone who can edit it, plus the daily deadline reminders.
 */

/**
 * Sets the document's goals. Each field is optional; `null` clears it, and a
 * field left out is not changed.
 */
export const setGoals = mutation({
  args: {
    documentId: v.id("documents"),
    wordTarget: v.optional(v.union(v.number(), v.null())),
    deadline: v.optional(v.union(v.number(), v.null())),
    sectionTargets: v.optional(
      v.union(v.array(v.object({ title: v.string(), words: v.number() })), v.null())
    ),
  },
  handler: async (ctx, args) => {
    const { document } = await requireDocumentAccess(ctx, args.documentId);
    const patch: {
      wordTarget?: number;
      deadline?: number;
      sectionTargets?: { title: string; words: number }[];
    } = {};

    if (args.wordTarget !== undefined) {
      patch.wordTarget = cleanWordTarget(args.wordTarget ?? undefined);
    }
    if (args.deadline !== undefined) {
      if (args.deadline !== null && !Number.isFinite(args.deadline)) {
        throw new Error("Choose a valid deadline");
      }
      patch.deadline = args.deadline ?? undefined;
    }
    if (args.sectionTargets !== undefined) {
      patch.sectionTargets = cleanSectionTargets(args.sectionTargets ?? []);
    }

    // `updatedAt` is left alone: goals are not an edit to the text, and
    // bumping it would put the document at the top of everyone's list.
    await ctx.db.patch(document._id, patch);
  },
});

/**
 * Cron, daily: reminds everyone with access to a document 7, 3 and 1 days
 * before its deadline. Binned documents are skipped.
 */
export const _remindDeadlines = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const window of reminderWindows(now)) {
      const due = await ctx.db
        .query("documents")
        .withIndex("by_deadline", (q) => q.gt("deadline", window.from).lte("deadline", window.to))
        .collect();

      for (const document of due) {
        if (document.deadline === undefined || (await isInTrash(ctx, document._id))) continue;

        // A run that starts late overlaps the previous day's window; one
        // reminder a day per document is the limit.
        const recent = await ctx.db
          .query("notifications")
          .withIndex("by_document", (q) => q.eq("documentId", document._id))
          .filter((q) =>
            q.and(q.eq(q.field("kind"), "deadline"), q.gt(q.field("createdAt"), now - REMINDER_GAP_MS))
          )
          .first();
        if (recent) continue;

        const recipients = await usersByClerkIds(ctx, await collaboratorIds(ctx, document));
        await notify(ctx, recipients, {
          kind: "deadline",
          documentId: document._id,
          actor: { name: "Colres", imageUrl: "" },
          preview: deadlineLabel(document.deadline, now),
        });
      }
    }
  },
});
