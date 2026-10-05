import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server.js";
import { requireDocumentAccess } from "./lib/auth.js";
import { bumpContribution } from "./lib/contributions.js";
import { parseBibtex } from "./lib/bibtexParse.js";
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
    v.literal("bibtex"),
    v.literal("pdf")
);

export const listReferences = query({
    args: { documentId: v.id("documents") },
    handler: async (ctx, args) => {
        await requireDocumentAccess(ctx, args.documentId, "view");

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
        month: v.optional(v.number()),
        venue: v.optional(v.string()),
        publisher: v.optional(v.string()),
        address: v.optional(v.string()),
        volume: v.optional(v.string()),
        number: v.optional(v.string()),
        pages: v.optional(v.string()),
        doi: v.optional(v.string()),
        url: v.optional(v.string()),
        accessed: v.optional(v.number()),
        edition: v.optional(v.string()),
        editors: v.optional(v.array(v.string())),
        authorAbbreviation: v.optional(v.string()),
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
            if (duplicate) return { id: duplicate._id, citationKey: duplicate.citationKey };
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
        // The key comes back with the id so a caller can cite the new entry
        // straight away — "Add & insert citation" does.
        const id = await ctx.db.insert("references", {
            documentId: args.documentId,
            citationKey,
            type: args.type ?? "article",
            title: args.title,
            authors: args.authors,
            year: args.year,
            month: args.month,
            venue: args.venue,
            publisher: args.publisher,
            address: args.address,
            volume: args.volume,
            number: args.number,
            pages: args.pages,
            doi: args.doi,
            url: args.url,
            accessed: args.accessed,
            edition: args.edition,
            editors: args.editors?.length ? args.editors : undefined,
            authorAbbreviation: args.authorAbbreviation?.trim() || undefined,
            abstract: args.abstract,
            source: args.source ?? "manual",
            externalId: args.externalId,
            addedBy: user._id,
            createdAt: now,
            updatedAt: now,
        });
        await bumpContribution(ctx, args.documentId, user._id, { references: 1 });
        return { id, citationKey };
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
        month: v.optional(v.number()),
        venue: v.optional(v.string()),
        publisher: v.optional(v.string()),
        address: v.optional(v.string()),
        volume: v.optional(v.string()),
        number: v.optional(v.string()),
        pages: v.optional(v.string()),
        doi: v.optional(v.string()),
        url: v.optional(v.string()),
        accessed: v.optional(v.number()),
        edition: v.optional(v.string()),
        editors: v.optional(v.array(v.string())),
        authorAbbreviation: v.optional(v.string()),
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

/** Largest .bib accepted in one import, and most entries taken from it. */
const MAX_BIB_CHARS = 2_000_000;
const MAX_BIB_ENTRIES = 500;

/** Keys LaTeX accepts in \cite{} without trouble. */
const SAFE_KEY = /^[A-Za-z0-9_:./+-]{1,100}$/;

const sameTitle = (a: string, b: string) =>
    a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Adds every entry of a .bib file (Zotero, Mendeley, JabRef, Overleaf…).
 *
 * The file's own citation keys are kept where they are free, so a paper
 * already citing `\cite{smith2020}` keeps working. Entries already in the
 * bibliography — the same DOI, or the same key with the same title — are
 * skipped rather than added twice.
 */
export const importBibtex = mutation({
    args: { documentId: v.id("documents"), text: v.string() },
    handler: async (ctx, args) => {
        const { user } = await requireDocumentAccess(ctx, args.documentId);
        if (args.text.length > MAX_BIB_CHARS) {
            throw new Error("This .bib file is too large to import (2 MB at most)");
        }

        const parsed = parseBibtex(args.text);
        const entries = parsed.references.slice(0, MAX_BIB_ENTRIES);

        const existing = await ctx.db
            .query("references")
            .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
            .collect();
        const byKey = new Map(existing.map((r) => [r.citationKey, r.title]));
        const dois = new Set(existing.flatMap((r) => (r.doi ? [r.doi.toLowerCase()] : [])));

        let added = 0;
        let duplicates = 0;
        const renamed: { from: string; to: string }[] = [];
        const now = Date.now();

        for (const entry of entries) {
            const doi = entry.doi?.toLowerCase();
            const keyTitle = byKey.get(entry.citationKey);
            if ((doi && dois.has(doi)) || (keyTitle !== undefined && sameTitle(keyTitle, entry.title))) {
                duplicates++;
                continue;
            }

            let citationKey = entry.citationKey;
            if (!SAFE_KEY.test(citationKey) || byKey.has(citationKey)) {
                citationKey = buildCitationKey(entry.authors, entry.year, byKey.keys());
                renamed.push({ from: entry.citationKey, to: citationKey });
            }

            await ctx.db.insert("references", {
                ...entry,
                documentId: args.documentId,
                citationKey,
                editors: entry.editors?.length ? entry.editors : undefined,
                source: "bibtex",
                addedBy: user._id,
                createdAt: now,
                updatedAt: now,
            });
            byKey.set(citationKey, entry.title);
            if (doi) dois.add(doi);
            added++;
        }

        if (added > 0) {
            await bumpContribution(ctx, args.documentId, user._id, { references: added });
        }

        return {
            added,
            duplicates,
            renamed,
            errors: parsed.errors,
            /** Entries past the limit, which were not imported. */
            skipped: parsed.references.length - entries.length,
        };
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
        await requireDocumentAccess(ctx, args.documentId, "view");
        const references = await ctx.db
            .query("references")
            .withIndex("by_document_id", (q) => q.eq("documentId", args.documentId))
            .collect();

        return toBibtexFile(
            references.sort((a, b) => a.citationKey.localeCompare(b.citationKey))
        );
    },
});

type CrossrefPerson = { given?: string | null; family?: string | null; name?: string | null };

/**
 * Crossref people as display names, dropping entries with no name at all.
 *
 * An organisation comes back as a single `name` rather than a given/family
 * pair, and is braced — "{World Health Organization}" — which is how the
 * formatters recognise a group author and keep it from being inverted.
 */
function personNames(people: CrossrefPerson[] | null | undefined): string[] {
    return (
        people
            ?.map((p) => (p.name ? `{${p.name.trim()}}` : [p.given, p.family].filter(Boolean).join(" ")))
            // An entry with neither a name nor a given/family pair yields an
            // empty string, which would render as a blank name in a citation.
            .filter((name) => name.replace(/[{}]/g, "").trim().length > 0) ?? []
    );
}

/**
 * A Crossref work record. Crossref nulls rather than omits in places — notably
 * `date-parts`, which is `[[null]]` for a work with no known date. The mapped
 * result is spread straight into `addReference`, whose `v.optional()`
 * validators accept `undefined` but reject `null`, so every nullable field is
 * declared as one and converted in `crossrefToReference`.
 */
type CrossrefWork = {
    type?: string | null;
    title?: string[] | null;
    author?: CrossrefPerson[] | null;
    editor?: CrossrefPerson[] | null;
    "edition-number"?: string | null;
    issued?: { "date-parts"?: (number | null)[][] | null } | null;
    "container-title"?: string[] | null;
    publisher?: string | null;
    "publisher-location"?: string | null;
    volume?: string | null;
    issue?: string | null;
    page?: string | null;
    "article-number"?: string | null;
    DOI?: string | null;
    URL?: string | null;
};

type ReferenceType =
    | "article"
    | "inproceedings"
    | "book"
    | "incollection"
    | "techreport"
    | "phdthesis"
    | "misc";

// Crossref type names do not map one-to-one onto BibTeX entry types.
const CROSSREF_TYPES: Record<string, ReferenceType> = {
    "journal-article": "article",
    "proceedings-article": "inproceedings",
    book: "book",
    monograph: "book",
    "edited-book": "book",
    "book-chapter": "incollection",
    report: "techreport",
    dissertation: "phdthesis",
    "posted-content": "misc",
};

/**
 * Crossref titles sometimes carry markup ("<i>Apis</i>") and a closing full
 * stop that is not part of the title; each style adds its own punctuation.
 */
function cleanTitle(title: string | null | undefined): string | undefined {
    const text = title
        ?.replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/(?<!\.\.)\.$/, "");
    return text || undefined;
}

/** A Crossref work as the fields `addReference` takes. */
function crossrefToReference(work: CrossrefWork, fallbackDoi?: string) {
    // Crossref gives the issue date as [year, month, day], with the later
    // parts simply absent when they are not known. IEEE prints the month in a
    // journal reference, so it is worth taking whenever Crossref has one.
    const issued = work.issued?.["date-parts"]?.[0];
    const year = issued?.[0];
    const month = issued?.[1];

    return {
        type: CROSSREF_TYPES[work.type ?? ""] ?? "misc",
        title: cleanTitle(work.title?.[0]) ?? "Untitled",
        authors: personNames(work.author),
        // Only meaningful for a chapter or paper in an edited book; for an
        // article Crossref's editors are the journal's, which no style prints.
        editors:
            work.type === "book-chapter" || work.type === "proceedings-article"
                ? personNames(work.editor)
                : [],
        edition: optionalText(work["edition-number"]),
        year: typeof year === "number" ? year : undefined,
        month: typeof month === "number" && month >= 1 && month <= 12 ? month : undefined,
        venue: cleanTitle(work["container-title"]?.[0]),
        publisher: optionalText(work.publisher),
        address: optionalText(work["publisher-location"]),
        volume: optionalText(work.volume),
        number: optionalText(work.issue),
        // An article-numbered journal has no page range; APA prints "Article e0193972".
        pages:
            optionalText(work.page) ??
            (optionalText(work["article-number"]) ? `Article ${work["article-number"]}` : undefined),
        doi: optionalText(work.DOI) ?? fallbackDoi,
        url: optionalText(work.URL),
    };
}

function crossrefHeaders() {
    const mailto = process.env.OPENALEX_MAILTO ?? "support@colres.app";
    return { mailto, headers: { "User-Agent": `colres (mailto:${mailto})` } };
}

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

    const { mailto, headers } = crossrefHeaders();
    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(mailto)}`,
      { headers }
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

    const body = (await response.json()) as { message?: CrossrefWork };
    const work = body.message;
    if (!work) {
      return { ok: false as const, error: "The DOI service returned no record." };
    }

    return { ok: true as const, reference: crossrefToReference(work, doi) };
  },
});

/**
 * Finds published works matching a title (and, optionally, an author's
 * surname) — used when a PDF carries no DOI of its own.
 *
 * Returns up to five candidates, best first by Crossref's own ranking. It does
 * not decide whether any of them *is* the paper: the caller compares titles,
 * because a search always returns something, and a confident wrong match is
 * worse than none.
 */
export const searchWorksByTitle = action({
  args: { title: v.string(), author: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: no verified identity on this request");
    }

    const title = args.title.trim();
    if (title.length < 8) return { ok: true as const, candidates: [] };

    const { mailto, headers } = crossrefHeaders();
    const params = new URLSearchParams({
      "query.bibliographic": title.slice(0, 300),
      rows: "5",
      mailto,
    });
    if (args.author?.trim()) params.set("query.author", args.author.trim());

    const response = await fetch(`https://api.crossref.org/works?${params}`, { headers });
    if (!response.ok) {
      return {
        ok: false as const,
        error: `The search service returned ${response.status}. Try again shortly.`,
      };
    }

    const body = (await response.json()) as { message?: { items?: CrossrefWork[] | null } };
    return {
      ok: true as const,
      candidates: (body.message?.items ?? []).map((work) => crossrefToReference(work)),
    };
  },
});
