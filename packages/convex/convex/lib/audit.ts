import type { Doc } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

export type AuditEntityType = Doc<"auditLog">["entityType"];

export type AuditEntry = {
  /** Dotted verb, e.g. "template.publish", "user.role", "document.delete". */
  action: string;
  entityType: AuditEntityType;
  entityId?: string;
  /** The entity's name at the time, so the entry still reads after a delete. */
  entityLabel: string;
  meta?: Record<string, unknown>;
};

/**
 * Records an admin action. Called from inside the mutation that performs the
 * action, so the entry commits (or rolls back) atomically with the change.
 */
export async function logAudit(ctx: MutationCtx, actor: Doc<"users">, entry: AuditEntry) {
  await ctx.db.insert("auditLog", {
    actorId: actor._id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    meta: entry.meta,
    createdAt: Date.now(),
  });
}
