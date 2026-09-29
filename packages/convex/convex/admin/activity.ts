import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { requireAdmin } from "../lib/auth.js";
import { auditEntityTypeValidator } from "../schema.js";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    entityType: v.optional(auditEntityTypeValidator),
    entityId: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const since = args.since ?? 0;

    // Pick the narrowest index, then filter whatever it does not cover.
    const base =
      args.entityType && args.entityId
        ? ctx.db
            .query("auditLog")
            .withIndex("by_entity", (q) =>
              q
                .eq("entityType", args.entityType as NonNullable<typeof args.entityType>)
                .eq("entityId", args.entityId)
                .gte("createdAt", since)
            )
        : args.actorId
          ? ctx.db
              .query("auditLog")
              .withIndex("by_actor", (q) =>
                q.eq("actorId", args.actorId as NonNullable<typeof args.actorId>).gte("createdAt", since)
              )
          : args.entityType
            ? ctx.db
                .query("auditLog")
                .withIndex("by_entity_type", (q) =>
                  q
                    .eq("entityType", args.entityType as NonNullable<typeof args.entityType>)
                    .gte("createdAt", since)
                )
            : ctx.db.query("auditLog").withIndex("by_created", (q) => q.gte("createdAt", since));

    const usedActorIndex = !(args.entityType && args.entityId) && Boolean(args.actorId);
    const ordered = base.order("desc");
    const filtered =
      args.actorId && !usedActorIndex
        ? ordered.filter((f) => f.eq(f.field("actorId"), args.actorId))
        : usedActorIndex && args.entityType
          ? ordered.filter((f) => f.eq(f.field("entityType"), args.entityType))
          : ordered;

    const page = await filtered.paginate(args.paginationOpts);

    const actorIds = [...new Set(page.page.map((row) => row.actorId))];
    const actors = new Map(
      (await Promise.all(actorIds.map((id) => ctx.db.get(id)))).flatMap((user) =>
        user ? [[user._id, { _id: user._id, name: user.name, imageUrl: user.imageUrl }] as const] : []
      )
    );

    return {
      ...page,
      page: page.page.map((row) => ({ ...row, actor: actors.get(row.actorId) ?? null })),
    };
  },
});
