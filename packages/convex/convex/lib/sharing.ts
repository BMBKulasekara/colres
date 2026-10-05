/**
 * Who can do what with a document. Shared by the Convex functions, the
 * Liveblocks auth route, and the editor, so all three agree.
 *
 * Kept free of Convex so it can be imported anywhere and tested on its own.
 */

/** A role given to someone a document is shared with. */
export type SharedRole = "editor" | "commenter" | "viewer";

/**
 * Everyone's role on a document: `owner` is its author, `member` is anyone in
 * its organization (both have full access, as before sharing existed), and the
 * rest come from `documentMembers`.
 */
export type DocumentRole = "owner" | "member" | SharedRole;

/** What an action needs. Each level includes the ones before it. */
export type AccessLevel = "view" | "comment" | "edit";

const RANK: Record<AccessLevel, number> = { view: 0, comment: 1, edit: 2 };

const GRANTS: Record<DocumentRole, AccessLevel> = {
  owner: "edit",
  member: "edit",
  editor: "edit",
  commenter: "comment",
  viewer: "view",
};

export const SHARED_ROLES: SharedRole[] = ["editor", "commenter", "viewer"];

export const ROLE_LABELS: Record<DocumentRole, string> = {
  owner: "Owner",
  member: "Organization member",
  editor: "Can edit",
  commenter: "Can comment",
  viewer: "Can view",
};

/** Whether `role` is enough for an action that needs `need`. */
export function roleAllows(role: DocumentRole | null, need: AccessLevel): boolean {
  return role !== null && RANK[GRANTS[role]] >= RANK[need];
}

/**
 * Whether `role` may invite, re-role and remove people. Only the people with
 * access through the workspace: invited people, editors included, cannot
 * pass the document on.
 */
export function canManageSharing(role: DocumentRole | null): boolean {
  return role === "owner" || role === "member";
}

/** Emails are matched case-insensitively and without stray spaces. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** A deliberately loose check: one @, something either side, a dot after it. */
export function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
