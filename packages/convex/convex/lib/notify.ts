import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Notifications older than this are deleted by the daily clean-up. */
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const PREVIEW_LENGTH = 140;

export type NotificationKind = Doc<"notifications">["kind"];

/** One line of text, cut to a preview's length on a word boundary. */
export function previewOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= PREVIEW_LENGTH) return flat;
  const cut = flat.slice(0, PREVIEW_LENGTH);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 80 ? cut.lastIndexOf(" ") : PREVIEW_LENGTH)}…`;
}

/**
 * The plain text of a Liveblocks comment body, which arrives as its JSON:
 * paragraphs of text runs, mentions and links.
 */
export function commentBodyText(json: string): string {
  try {
    const body = JSON.parse(json) as { content?: { children?: Record<string, unknown>[] }[] };
    return (body.content ?? [])
      .map((block) =>
        (block.children ?? [])
          .map((child) => {
            if (typeof child.text === "string") return child.text;
            if (child.type === "mention") return "@someone";
            if (typeof child.url === "string") return child.url;
            return "";
          })
          .join("")
      )
      .join(" ");
  } catch {
    return json;
  }
}

/**
 * Notifies each recipient once, never the actor themselves. Recipients are
 * users ids; duplicates are ignored.
 */
export async function notify(
  ctx: MutationCtx,
  recipients: Iterable<Id<"users">>,
  event: {
    kind: NotificationKind;
    documentId: Id<"documents">;
    actor: Doc<"users"> | { _id?: Id<"users">; name: string; imageUrl: string };
    preview: string;
  }
) {
  const now = Date.now();
  const sent = new Set<string>();
  for (const userId of recipients) {
    if (userId === event.actor._id || sent.has(userId)) continue;
    sent.add(userId);
    await ctx.db.insert("notifications", {
      userId,
      kind: event.kind,
      documentId: event.documentId,
      actorName: event.actor.name,
      actorAvatar: event.actor.imageUrl,
      preview: previewOf(event.preview),
      createdAt: now,
    });
  }
}

/** Users ids for Clerk ids, skipping anyone without a profile row. */
export async function usersByClerkIds(ctx: MutationCtx, clerkIds: Iterable<string>) {
  const ids: Id<"users">[] = [];
  for (const clerkId of new Set(clerkIds)) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .first();
    if (user) ids.push(user._id);
  }
  return ids;
}
