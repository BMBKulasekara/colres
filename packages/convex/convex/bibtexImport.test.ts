import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { latexToText, parseBibtex, splitNames } from "./lib/bibtexParse.js";
import { setupConvex, signedInAs } from "./test.setup.js";

const ZOTERO = String.raw`
% Exported by Zotero. Contact: someone@example.com
@string{neurips = "Advances in Neural Information Processing Systems"}

@inproceedings{vaswani2017,
  title = {Attention Is All You Need},
  author = {Vaswani, Ashish and Shazeer, Noam and others},
  booktitle = neurips,
  year = {2017},
  month = jun,
  pages = {5998--6008},
  doi = {https://doi.org/10.5555/3295222},
}

@article{muller2020,
  title = "{BERT} for {G}erman: a {\"u}ber-model",
  author = {M{\"u}ller, J{\"o}rg and {World Health Organization}},
  journal = {Journal of R\&D},
  volume = 12, number = {3},
  date = {2020-05-14},
  urldate = {2022-07-18},
  url = {https://example.org/a?b=1&c=2},
}

@comment{jabref-meta: databaseType:bibtex;}

@book{broken, title = {Missing a closing brace
@misc{notitle, author = {Nobody}}
@phdthesis{doe2019, title = {A Thesis}, author = {Jane Doe}, school = {MIT}, year = 2019}
`;

describe("parsing .bib files", () => {
    test("reads entries, string macros, month macros and biblatex dates", () => {
        const { references } = parseBibtex(ZOTERO);
        const [vaswani, muller, doe] = references;

        expect(vaswani).toMatchObject({
            citationKey: "vaswani2017",
            type: "inproceedings",
            title: "Attention Is All You Need",
            authors: ["Vaswani, Ashish", "Shazeer, Noam"],
            venue: "Advances in Neural Information Processing Systems",
            year: 2017,
            month: 6,
            pages: "5998-6008",
            doi: "10.5555/3295222",
        });
        expect(muller).toMatchObject({
            type: "article",
            title: "BERT for German: a über-model",
            authors: ["Müller, Jörg", "{World Health Organization}"],
            venue: "Journal of R&D",
            volume: "12",
            number: "3",
            year: 2020,
            month: 5,
            accessed: Date.UTC(2022, 6, 18),
            url: "https://example.org/a?b=1&c=2",
        });
        expect(doe).toMatchObject({ type: "phdthesis", venue: "MIT", year: 2019 });
    });

    test("a broken entry is reported and the rest of the file still imports", () => {
        const { references, errors } = parseBibtex(ZOTERO);
        expect(references.map((r) => r.citationKey)).toEqual(["vaswani2017", "muller2020", "doe2019"]);
        expect(errors).toHaveLength(2);
        expect(errors.join("\n")).toMatch(/"notitle": has no title/);
    });

    test("LaTeX accents and markup become plain text", () => {
        expect(latexToText(String.raw`Erd\H{o}s, Gau\ss, \c{C}elik, \AA{}ngstr{\"o}m`)).toBe(
            "Erdős, Gauß, Çelik, Ångström"
        );
        expect(latexToText(String.raw`\emph{Deep} learning: 50\% faster`)).toBe("Deep learning: 50% faster");
    });

    test("names split on 'and' outside braces only", () => {
        expect(splitNames("{Barnes and Noble} and Jane Doe and others")).toEqual([
            "{Barnes and Noble}",
            "Jane Doe",
        ]);
    });
});

describe("importing into a document", () => {
    async function setup() {
        const t = setupConvex();
        const ada = await signedInAs(t, { clerkId: "user_ada" });
        const documentId = await t.run((ctx) =>
            ctx.db.insert("documents", {
                author: ada.userId,
                title: "Draft",
                slug: "draft",
                status: false,
                content: "",
                createdAt: Date.now(),
                updatedAt: Date.now(),
            })
        );
        return { t, ada, documentId };
    }

    test("adds entries with their own keys, and reports what it could not read", async () => {
        const { ada, documentId } = await setup();
        const result = await ada.as.mutation(api.references.importBibtex, { documentId, text: ZOTERO });

        expect(result).toMatchObject({ added: 3, duplicates: 0, renamed: [], skipped: 0 });
        expect(result.errors).toHaveLength(2);

        const refs = await ada.as.query(api.references.listReferences, { documentId });
        expect(refs.map((r) => r.citationKey).sort()).toEqual(["doe2019", "muller2020", "vaswani2017"]);
        expect(refs.every((r) => r.source === "bibtex")).toBe(true);
    });

    test("importing the same file twice adds nothing the second time", async () => {
        const { ada, documentId } = await setup();
        await ada.as.mutation(api.references.importBibtex, { documentId, text: ZOTERO });
        const again = await ada.as.mutation(api.references.importBibtex, { documentId, text: ZOTERO });

        expect(again).toMatchObject({ added: 0, duplicates: 3 });
    });

    test("a key already used by a different paper gets a new key", async () => {
        const { ada, documentId } = await setup();
        await ada.as.mutation(api.references.addReference, {
            documentId,
            title: "Something else",
            authors: ["Jane Doe"],
            year: 2019,
        });
        const result = await ada.as.mutation(api.references.importBibtex, {
            documentId,
            text: "@misc{doe2019, title = {A Thesis}, author = {Jane Doe}, year = 2019}",
        });

        expect(result.renamed).toEqual([{ from: "doe2019", to: "doe2019a" }]);
    });

    test("a viewer cannot import", async () => {
        const { t, ada, documentId } = await setup();
        const sam = await signedInAs(t, { clerkId: "user_sam" });
        await ada.as.mutation(api.sharing.invite, { documentId, email: "user_sam@example.com", role: "viewer" });

        await expect(
            sam.as.mutation(api.references.importBibtex, { documentId, text: ZOTERO })
        ).rejects.toThrow(/Forbidden/);
    });
});
