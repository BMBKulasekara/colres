import type { Doc } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { type AccessLevel, type DocumentRole, normalizeEmail, roleAllows } from "./sharing.js";

type Ctx = QueryCtx | MutationCtx;

/**
 * The Clerk user id of the caller, taken from the verified JWT rather than
 * from a client-supplied argument. Anything derived from a `clerkId` argument
 * is forgeable, because the Convex deployment URL ships in the browser bundle
 * and mutations can be called directly.
 */
export async function getCallerClerkId(ctx: Ctx): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export async function requireCallerClerkId(ctx: Ctx): Promise<string> {
  const clerkId = await getCallerClerkId(ctx);
  if (!clerkId) {
    throw new Error("Unauthenticated: no verified identity on this request");
  }
  return clerkId;
}

/**
 * The signed-in caller's row in `users`, or null when their profile has not
 * been synced yet.
 *
 * On a first sign-in the client mirrors the Clerk profile into `users` from an
 * effect, while pages start querying immediately. Read paths should treat that
 * window as "no data yet" and let the query re-run reactively once the row
 * lands, rather than surfacing an error to a user who is in fact signed in.
 */
export async function getUserOrNull(ctx: Ctx): Promise<Doc<"users"> | null> {
  const clerkId = await getCallerClerkId(ctx);
  if (!clerkId) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();
}

/** The signed-in caller's row in `users`. Throws if absent or not synced yet. */
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const clerkId = await requireCallerClerkId(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  if (!user) {
    throw new Error("Unauthenticated: signed-in user has no profile record");
  }
  return user;
}

export async function requireAdmin(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: this action requires an admin account");
  }
  return user;
}

/** True when `document` is in the caller's workspace: theirs, or their org's. */
export function isDocumentMember(
  document: Pick<Doc<"documents">, "author" | "orgId">,
  user: Doc<"users">
): boolean {
  if (document.author === user._id) return true;
  if (!document.orgId) return false;
  // Org documents are shared with everyone Clerk reports as a member of that org.
  return (user.orgIds ?? []).includes(document.orgId);
}

/** True when the document is in the recycle bin. */
export async function isInTrash(ctx: Ctx, documentId: Doc<"documents">["_id"]): Promise<boolean> {
  const entry = await ctx.db
    .query("trash")
    .withIndex("by_document", (q) => q.eq("documentId", documentId))
    .first();
  return entry !== null;
}

/**
 * The caller's role on `document`, or null for none. The author and the
 * organization's members come first and are unaffected by sharing; anyone
 * else is looked up in `documentMembers` by their email.
 *
 * A binned document is closed to everything but the bin itself (see
 * trash.ts), which is what hides it from the editor, chat, comments and
 * references at once.
 */
export async function documentRole(
  ctx: Ctx,
  document: Doc<"documents">,
  user: Doc<"users">
): Promise<DocumentRole | null> {
  if (await isInTrash(ctx, document._id)) return null;
  if (document.author === user._id) return "owner";
  if (isDocumentMember(document, user)) return "member";

  const shared = await ctx.db
    .query("documentMembers")
    .withIndex("by_document_email", (q) =>
      q.eq("documentId", document._id).eq("email", normalizeEmail(user.email))
    )
    .first();
  return shared?.role ?? null;
}

/**
 * True when the caller may do something needing `need` with `document`.
 *
 * `need` defaults to "edit", so a check that does not say otherwise stays
 * closed to people the document was shared with as commenter or viewer.
 */
export async function canAccessDocument(
  ctx: Ctx,
  document: Doc<"documents">,
  user: Doc<"users">,
  need: AccessLevel = "edit"
): Promise<boolean> {
  return roleAllows(await documentRole(ctx, document, user), need);
}

export async function requireDocumentAccess(
  ctx: Ctx,
  documentId: Doc<"documents">["_id"],
  need: AccessLevel = "edit"
): Promise<{ user: Doc<"users">; document: Doc<"documents">; role: DocumentRole }> {
  const user = await requireUser(ctx);
  const document = await ctx.db.get(documentId);
  if (!document) {
    throw new Error("Document not found");
  }
  const role = await documentRole(ctx, document, user);
  if (!role || !roleAllows(role, need)) {
    throw new Error("Forbidden: you do not have access to this document");
  }
  return { user, document, role };
}

/**
 * Same check for callers that identify a document by either its id or its
 * slug. Chat and comment functions are called with the Liveblocks room id,
 * which is the document id, but slugs are accepted too.
 */
export async function requireDocumentAccessByRef(
  ctx: Ctx,
  ref: string,
  need: AccessLevel = "edit"
): Promise<{ user: Doc<"users">; document: Doc<"documents">; role: DocumentRole }> {
  const user = await requireUser(ctx);

  const bySlug = await ctx.db
    .query("documents")
    .withIndex("by_slug", (q) => q.eq("slug", ref))
    .first();

  // `ctx.db.get` throws rather than returning null when the string is not a
  // well-formed id, which happens whenever the ref was a slug that missed.
  let document = bySlug;
  if (!document) {
    try {
      document = await ctx.db.get(ref as Doc<"documents">["_id"]);
    } catch {
      document = null;
    }
  }

  if (!document) {
    throw new Error("Document not found");
  }
  const role = await documentRole(ctx, document, user);
  if (!role || !roleAllows(role, need)) {
    throw new Error("Forbidden: you do not have access to this document");
  }
  return { user, document, role };
}
