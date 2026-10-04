import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { setupConvex, signedInAs } from "./test.setup.js";

describe("users.upsert", () => {
  test("rejects a caller with no verified identity", async () => {
    const t = setupConvex();
    await expect(
      t.mutation(api.users.upsert, { name: "Ada", email: "ada@example.com" })
    ).rejects.toThrow(/Unauthenticated/);
  });

  test("creates the caller's row as a plain user", async () => {
    const t = setupConvex();
    const ada = t.withIdentity({ subject: "user_ada" });

    const id = await ada.mutation(api.users.upsert, { name: "Ada", email: "ada@example.com" });

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({ clerkId: "user_ada", name: "Ada", role: "user", imageUrl: "" });
  });

  test("updates the existing row on a second sign-in instead of duplicating it", async () => {
    const t = setupConvex();
    const ada = t.withIdentity({ subject: "user_ada" });

    const first = await ada.mutation(api.users.upsert, { name: "Ada", email: "ada@example.com" });
    const second = await ada.mutation(api.users.upsert, {
      name: "Ada Lovelace",
      email: "ada@example.com",
    });

    expect(second).toEqual(first);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Ada Lovelace");
  });

  test("never changes an existing admin's role", async () => {
    const t = setupConvex();
    const { userId, as } = await signedInAs(t, { clerkId: "user_root", role: "admin" });

    await as.mutation(api.users.upsert, { name: "Root", email: "root@example.com" });

    const row = await t.run((ctx) => ctx.db.get(userId));
    expect(row?.role).toBe("admin");
  });
});

describe("users.getByClerkId", () => {
  test("a user can read their own profile", async () => {
    const t = setupConvex();
    const { as } = await signedInAs(t, { clerkId: "user_ada" });

    const row = await as.query(api.users.getByClerkId, { clerkId: "user_ada" });
    expect(row?.clerkId).toBe("user_ada");
  });

  test("a user cannot read somebody else's profile", async () => {
    const t = setupConvex();
    const { as } = await signedInAs(t, { clerkId: "user_ada" });
    await signedInAs(t, { clerkId: "user_grace" });

    await expect(as.query(api.users.getByClerkId, { clerkId: "user_grace" })).rejects.toThrow(
      /Forbidden/
    );
  });

  test("an admin can read anyone's profile", async () => {
    const t = setupConvex();
    const { as } = await signedInAs(t, { clerkId: "user_root", role: "admin" });
    await signedInAs(t, { clerkId: "user_grace" });

    const row = await as.query(api.users.getByClerkId, { clerkId: "user_grace" });
    expect(row?.clerkId).toBe("user_grace");
  });
});

describe("users.getAllUsers", () => {
  test("is admin-only", async () => {
    const t = setupConvex();
    const { as } = await signedInAs(t, { clerkId: "user_ada" });

    await expect(as.query(api.users.getAllUsers, {})).rejects.toThrow(/Forbidden/);
  });
});
