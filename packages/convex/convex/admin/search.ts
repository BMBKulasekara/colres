import { v } from "convex/values";
import { query } from "../_generated/server.js";
import { requireAdmin } from "../lib/auth.js";

const LIMIT = 5;

/** Backs the ⌘K palette: a few matches from each kind of record. */
export const global = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const q = args.q.trim();
    if (q.length < 2) {
      return { documents: [], templates: [], users: [], organizations: [] };
    }
    const needle = q.toLowerCase();

    const [documents, users, organizations, templates] = await Promise.all([
      ctx.db
        .query("documents")
        .withSearchIndex("search_title", (s) => s.search("title", q))
        .take(LIMIT),
      ctx.db
        .query("users")
        .withSearchIndex("search_name", (s) => s.search("name", q))
        .take(LIMIT),
      ctx.db
        .query("organizations")
        .withSearchIndex("search_name", (s) => s.search("name", q))
        .take(LIMIT),
      // Templates are a small curated set; a substring match beats a search
      // index for names like "IEEE" or "APA 7".
      ctx.db.query("templates").collect(),
    ]);

    return {
      documents: documents.map((d) => ({ _id: d._id, title: d.title, slug: d.slug, status: d.status })),
      users: users.map((u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role })),
      organizations: organizations.map((o) => ({ _id: o._id, name: o.name, slug: o.slug })),
      templates: templates
        .filter((t) => `${t.name} ${t.slug}`.toLowerCase().includes(needle))
        .slice(0, LIMIT)
        .map((t) => ({ _id: t._id, name: t.name, status: t.status })),
    };
  },
});
