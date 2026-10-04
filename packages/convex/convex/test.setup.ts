/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import schema from "./schema.js";

/**
 * Every Convex module, for convex-test to resolve `api.*` references against.
 *
 * The negated pattern skips files with more than one dot, which leaves out
 * tests, `auth.config.ts` and the generated `.d.ts` files. The Convex CLI
 * applies the same rule when bundling, so neither the tests nor this file is
 * deployed. (The `!(*.*.*)` extglob in Convex's docs matches nothing under
 * Vite 8, hence the two-pattern form.)
 */
export const modules = import.meta.glob(["./**/*.*s", "!./**/*.*.*s"]);

export function setupConvex() {
  return convexTest(schema, modules);
}

export type TestConvex = ReturnType<typeof setupConvex>;

/** Inserts a `users` row and returns a client authenticated as that user. */
export async function signedInAs(
  t: TestConvex,
  profile: { clerkId: string; name?: string; role?: "admin" | "user"; orgIds?: string[] }
) {
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      clerkId: profile.clerkId,
      name: profile.name ?? profile.clerkId,
      email: `${profile.clerkId}@example.com`,
      imageUrl: "",
      role: profile.role ?? "user",
      createdAt: Date.now(),
      orgIds: profile.orgIds,
    })
  );
  return { userId, as: t.withIdentity({ subject: profile.clerkId }) };
}
