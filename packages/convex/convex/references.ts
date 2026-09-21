import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server.js";
import { requireDocumentAccess } from "./lib/auth.js";
import { buildCitationKey, toBibtexFile, unprotectedCapitals } from "./lib/citations.js";
import { optionalText } from "./lib/externalData.js";

const referenceTypeValidator = v.union(
    v.literal("article"),
    v.literal("inproceedings"),
    v.literal("book"),
    v.literal("incollection"),
    v.literal("techreport"),
    v.literal("phdthesis"),
    v.literal("misc")
);

const sourceValidator = v.union(
    v.literal("openalex"),
    v.literal("doi"),
    v.literal("manual"),
    v.literal("bibtex")
);

export const listReferences = query({
    args: { documentId: v.id("documents") },
    handler: async (ctx, args) => {
        await requireDocumentAccess(ctx, args.documentId);

        const references = await ctx.db
            .query("references")
            .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
            .collect();

        return references
            .sort((a, b) => a.citationKey.localeCompare(b.citationKey))
            .map((reference) => ({
                ...reference,
                // Surfaced by the .bib editor: unbraced capitals get lowercased
                // by many BibTeX styles ("The TeXbook" -> "The texbook").
                unprotectedCapitals: unprotectedCapitals(reference.title),
            }));
    },
});

export const addReference = mutation({
    args: {
        documentId: v.id("documents"),
        type: v.optional(referenceTypeValidator),
        title: v.string(),
        authors: v.array(v.string()),
        year: v.optional(v.number()),
        venue: v.optional(v.string()),
        publisher: v.optional(v.string()),
        volume: v.optional(v.string()),
        number: v.optional(v.string()),
        pages: v.optional(v.string()),
        doi: v.optional(v.string()),
        url: v.optional(v.string()),
        abstract: v.optional(v.string()),
        source: v.optional(sourceValidator),
        externalId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { user } = await requireDocumentAccess(ctx, args.documentId);

        // A paper saved twice from the research panel should reuse its entry
        // rather than create a second one with a suffixed key.
        if (args.externalId) {
            const duplicate = await ctx.db
                .query("references")
                .withIndex("by_document_and_external_id", (q) =>
                    q.eq("documentId", args.documentId).eq("externalId", args.externalId)
                )
                .first();
            if (duplicate) return duplicate._id;
        }

        const taken = await ctx.db
            .query("references")
            .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
            .collect();

        const citationKey = buildCitationKey(
            args.authors,
            args.year,
            taken.map((row) => row.citationKey)
        );

        const now = Date.now();
        return await ctx.db.insert("references", {
            documentId: args.documentId,
            citationKey,
            type: args.type ?? "article",
            title: args.title,
            authors: args.authors,
            year: args.year,
            venue: args.venue,
            publisher: args.publisher,
            volume: args.volume,
            number: args.number,
            pages: args.pages,
            doi: args.doi,
            url: args.url,
            abstract: args.abstract,
            source: args.source ?? "manual",
            externalId: args.externalId,
            addedBy: user._id,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateReference = mutation({
    args: {
        id: v.id("references"),
        citationKey: v.optional(v.string()),
        type: v.optional(referenceTypeValidator),
        title: v.optional(v.string()),
        authors: v.optional(v.array(v.string())),
        year: v.optional(v.number()),
        venue: v.optional(v.string()),
        publisher: v.optional(v.string()),
        volume: v.optional(v.string()),
        number: v.optional(v.string()),
        pages: v.optional(v.string()),
        doi: v.optional(v.string()),
        url: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { id, ...updates } = args;
        const reference = await ctx.db.get(id);
        if (!reference) {
            throw new Error("Reference not found");
        }
        await requireDocumentAccess(ctx, reference.documentId);

        if (updates.citationKey && updates.citationKey !== reference.citationKey) {
            const clash = await ctx.db
                .query("references")
                .withIndex("by_document_and_key", (q) =>
                    q
                        .eq("documentId", reference.documentId)
                        .eq("citationKey", updates.citationKey as string)
                )
                .first();
            if (clash) {
                throw new Error(`Citation key "${updates.citationKey}" is already used`);
            }
        }

        const patch: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) patch[key] = value;
        }

        await ctx.db.patch(id, { ...patch, updatedAt: Date.now() });
        return await ctx.db.get(id);
    },
});

export const deleteReference = mutation({
    args: { id: v.id("references") },
    handler: async (ctx, args) => {
        const reference = await ctx.db.get(args.id);
        if (!reference) {
            throw new Error("Reference not found");
        }
        await requireDocumentAccess(ctx, reference.documentId);
        await ctx.db.delete(args.id);
        return reference;
    },
});

/** refs.bib for the document, used by the download and the LaTeX export. */
export const exportBibtex = query({
    args: { documentId: v.id("documents") },
    handler: async (ctx, args) => {
        await requireDocumentAccess(ctx, args.documentId);
        const references = await ctx.db
            .query("references")
            .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
            .collect();

        return toBibtexFile(
            references.sort((a, b) => a.citationKey.localeCompare(b.citationKey))
        );
    },
});

/**
 * Resolves a DOI to bibliographic metadata via Crossref.
 *
 * Returns the fields ready for `addReference` rather than writing anything, so
 * the author can correct the result before it lands in the bibliography.
 */
export const lookupDoi = action({
  args: { doi: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: no verified identity on this request");
    }

    // Accept a bare DOI, a doi.org URL, or a "doi:" prefix.
    const doi = args.doi
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "");

    if (!/^10\.\d{4,9}\/\S+$/.test(doi)) {
      return { ok: false as const, error: "That does not look like a DOI." };
    }

    const mailto = process.env.OPENALEX_MAILTO ?? "support@colres.app";
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(mailto)}`,
      { headers: { "User-Agent": `colres (mailto:${mailto})` } }
    );

    if (response.status === 404) {
      return { ok: false as const, error: "No record found for that DOI." };
    }
    if (!response.ok) {
      return {
        ok: false as const,
        error: `The DOI service returned ${response.status}. Try again shortly.`,
      };
    }

    // Crossref nulls rather than omits in places — notably `date-parts`, which
    // is `[[null]]` for a work with no known date. The result of this lookup is
    // spread straight into `addReference`, whose `v.optional()` validators
    // accept `undefined` but reject `null`, so every nullable field has to be
    // declared as one and converted below.
    const body = (await response.json()) as {
      message?: {
        type?: string | null;
        title?: string[] | null;
        author?: { given?: string | null; family?: string | null; name?: string | null }[] | null;
        issued?: { "date-parts"?: (number | null)[][] | null } | null;
        "container-title"?: string[] | null;
        publisher?: string | null;
        volume?: string | null;
        issue?: string | null;
        page?: string | null;
        DOI?: string | null;
        URL?: string | null;
      };
    };

    const work = body.message;
    if (!work) {
      return { ok: false as const, error: "The DOI service returned no record." };
    }

    // Crossref type names do not map one-to-one onto BibTeX entry types.
    const typeMap: Record<string, string> = {
      "journal-article": "article",
      "proceedings-article": "inproceedings",
      book: "book",
      "book-chapter": "incollection",
      "report": "techreport",
      dissertation: "phdthesis",
    };

    const year = work.issued?.["date-parts"]?.[0]?.[0];

    return {
      ok: true as const,
      reference: {
        type: (typeMap[work.type ?? ""] ?? "misc") as
          | "article"
          | "inproceedings"
          | "book"
          | "incollection"
          | "techreport"
          | "phdthesis"
          | "misc",
        title: work.title?.[0] ?? "Untitled",
        authors:
          work.author
            ?.map((a) => a.name ?? [a.given, a.family].filter(Boolean).join(" "))
            // An entry with neither a name nor a given/family pair yields an
            // empty string, which would render as a blank author in a citation.
            .filter((name) => name.trim().length > 0) ?? [],
        year: typeof year === "number" ? year : undefined,
        venue: optionalText(work["container-title"]?.[0]),
        publisher: optionalText(work.publisher),
        volume: optionalText(work.volume),
        number: optionalText(work.issue),
        pages: optionalText(work.page),
        doi: optionalText(work.DOI) ?? doi,
        url: optionalText(work.URL),
      },
    };
  },
});
