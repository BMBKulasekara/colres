/**
 * Reading `.bib` files, as exported by Zotero, Mendeley, JabRef, Google
 * Scholar and Overleaf, into the fields `references` stores.
 *
 * Kept free of Convex so the rules can be tested on their own. The parser is
 * forgiving: an entry it cannot read is reported and skipped, never allowed
 * to take the rest of the file down with it.
 */

import type { ReferenceType } from "./citations.js";

export interface ParsedReference {
    /** The key in the file, kept when it is free so existing `\cite{}`s still match. */
    citationKey: string;
    type: ReferenceType;
    title: string;
    authors: string[];
    year?: number;
    month?: number;
    venue?: string;
    publisher?: string;
    address?: string;
    volume?: string;
    number?: string;
    pages?: string;
    doi?: string;
    url?: string;
    accessed?: number;
    edition?: string;
    editors?: string[];
    abstract?: string;
}

export interface ParseResult {
    references: ParsedReference[];
    /** One line per entry that could not be read. */
    errors: string[];
}

const TYPE_MAP: Record<string, ReferenceType> = {
    article: "article",
    inproceedings: "inproceedings",
    conference: "inproceedings",
    book: "book",
    mvbook: "book",
    incollection: "incollection",
    inbook: "incollection",
    techreport: "techreport",
    report: "techreport",
    phdthesis: "phdthesis",
    thesis: "phdthesis",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Accents written as LaTeX commands: \"o, \'e, \c{c}, {\ss}. */
const ACCENTS: Record<string, string> = {
    '"': "̈",
    "'": "́",
    "`": "̀",
    "^": "̂",
    "~": "̃",
    "=": "̄",
    ".": "̇",
    u: "̆",
    v: "̌",
    H: "̋",
    c: "̧",
    k: "̨",
    r: "̊",
};

const LETTERS: Record<string, string> = {
    ss: "ß",
    ae: "æ",
    AE: "Æ",
    oe: "œ",
    OE: "Œ",
    o: "ø",
    O: "Ø",
    aa: "å",
    AA: "Å",
    l: "ł",
    L: "Ł",
    i: "ı",
};

/** LaTeX markup in a field value turned into plain text. */
export function latexToText(value: string): string {
    return (
        value
            // \"{o}, \"o, {\"o}
            .replace(/\\(["'`^~=.])\s*\{?\s*([A-Za-z])\s*\}?/g, (_, mark: string, ch: string) =>
                `${ch}${ACCENTS[mark]}`.normalize("NFC")
            )
            // \c{c}, \v{s}, \u{a}
            .replace(/\\([uvHckr])\s*\{\s*([A-Za-z])\s*\}/g, (_, mark: string, ch: string) =>
                `${ch}${ACCENTS[mark]}`.normalize("NFC")
            )
            // \ss, {\o}, \AA
            .replace(/\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L|i)(?![A-Za-z])\s?/g, (_, name: string) => LETTERS[name] ?? name)
            // \textit{x}, \emph{x} and friends keep their argument.
            .replace(/\\[A-Za-z]+\s*\{([^{}]*)\}/g, "$1")
            .replace(/\\([&%$#_{}])/g, "$1")
            .replace(/--/g, "–")
            .replace(/~/g, " ")
            .replace(/[{}]/g, "")
            .replace(/\s+/g, " ")
            .trim()
    );
}

/**
 * Splits a name list on the word "and" outside braces, so
 * "{Barnes and Noble} and Jane Doe" is two names.
 */
export function splitNames(value: string): string[] {
    const names: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        else if (depth === 0 && /\s/.test(ch ?? "") && /^\s+and\s+/i.test(value.slice(i))) {
            names.push(value.slice(start, i));
            const match = /^\s+and\s+/i.exec(value.slice(i));
            i += (match?.[0].length ?? 1) - 1;
            start = i + 1;
        }
    }
    names.push(value.slice(start));

    return names
        .map((name) => name.trim())
        .filter((name) => name && name.toLowerCase() !== "others")
        .map((name) =>
            // A fully braced name is an organisation; the app keeps it braced
            // so it is never split into surname and initials.
            /^\{[^{}]+\}$/.test(name) ? `{${latexToText(name)}}` : latexToText(name)
        );
}

/* ------------------------------------------------------------------------- */
/* Tokenising                                                                */
/* ------------------------------------------------------------------------- */

class Reader {
    pos = 0;
    constructor(readonly text: string) {}

    skipSpace() {
        while (this.pos < this.text.length && /\s/.test(this.text[this.pos] ?? "")) this.pos++;
    }

    peek() {
        this.skipSpace();
        return this.text[this.pos];
    }

    expect(ch: string) {
        if (this.peek() !== ch) throw new Error(`expected "${ch}"`);
        this.pos++;
    }

    word(): string {
        this.skipSpace();
        const match = /^[^\s,={}()"#]+/.exec(this.text.slice(this.pos));
        if (!match) throw new Error("expected a name");
        this.pos += match[0].length;
        return match[0];
    }

    /** `{...}` with nested braces, or `"..."` with braces allowed inside. */
    delimited(): string {
        const open = this.text[this.pos];
        const close = open === "{" ? "}" : '"';
        let depth = 0;
        const start = ++this.pos;
        while (this.pos < this.text.length) {
            const ch = this.text[this.pos];
            if (ch === "\\") {
                this.pos += 2;
                continue;
            }
            if (ch === "{") depth++;
            else if (ch === "}" && depth > 0) depth--;
            else if (ch === close && depth === 0) {
                return this.text.slice(start, this.pos++);
            }
            this.pos++;
        }
        throw new Error("unterminated value");
    }

    /** A field value: pieces joined with `#`, each braced, quoted, a number, or a macro. */
    value(macros: Map<string, string>): string {
        const parts: string[] = [];
        for (;;) {
            const ch = this.peek();
            if (ch === "{" || ch === '"') parts.push(this.delimited());
            else {
                const name = this.word();
                parts.push(/^\d+$/.test(name) ? name : (macros.get(name.toLowerCase()) ?? name));
            }
            if (this.peek() !== "#") return parts.join("");
            this.pos++;
        }
    }
}

/* ------------------------------------------------------------------------- */
/* Fields to a reference                                                     */
/* ------------------------------------------------------------------------- */

function monthOf(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const text = value.trim().toLowerCase();
    const number = Number.parseInt(text, 10);
    if (number >= 1 && number <= 12) return number;
    const index = MONTHS.indexOf(text.slice(0, 3));
    return index === -1 ? undefined : index + 1;
}

function text(fields: Map<string, string>, ...names: string[]): string | undefined {
    for (const name of names) {
        const value = fields.get(name);
        if (value !== undefined) {
            const clean = latexToText(value);
            if (clean) return clean;
        }
    }
    return undefined;
}

function toReference(type: string, key: string, fields: Map<string, string>): ParsedReference {
    const title = text(fields, "title", "booktitle");
    if (!title) throw new Error("has no title");

    // biblatex's `date = {2020-05-14}` carries year and month together.
    const date = fields.get("date")?.match(/(\d{4})(?:-(\d{2}))?/);
    const yearText = text(fields, "year") ?? date?.[1];
    const year = yearText ? Number.parseInt(yearText.match(/\d{4}/)?.[0] ?? "", 10) : undefined;

    const urldate = fields.get("urldate")?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    const accessed = urldate ? Date.parse(`${urldate}T00:00:00Z`) : undefined;

    const isChapter = type === "incollection" || type === "inproceedings" || type === "inbook";
    const doi = text(fields, "doi")?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");

    return {
        citationKey: key,
        type: TYPE_MAP[type] ?? "misc",
        title,
        authors: splitNames(fields.get("author") ?? ""),
        year: Number.isFinite(year) ? year : undefined,
        month: monthOf(fields.get("month")) ?? (date?.[2] ? Number.parseInt(date[2], 10) : undefined),
        venue: isChapter
            ? text(fields, "booktitle", "journal", "journaltitle")
            : text(fields, "journal", "journaltitle", "booktitle", "school", "institution", "howpublished"),
        publisher: text(fields, "publisher", ...(type.endsWith("thesis") ? [] : ["institution"])),
        address: text(fields, "address", "location"),
        volume: text(fields, "volume"),
        number: text(fields, "number", "issue"),
        // The app stores ranges with a plain hyphen, as Crossref sends them.
        pages: fields.get("pages")?.replace(/\s*-+\s*/g, "-").replace(/[{}]/g, "").trim() || undefined,
        doi,
        url: fields.get("url")?.trim() || undefined,
        accessed: Number.isFinite(accessed) ? accessed : undefined,
        edition: text(fields, "edition"),
        editors: fields.get("editor") ? splitNames(fields.get("editor") ?? "") : undefined,
        abstract: text(fields, "abstract"),
    };
}

/** Parses a whole `.bib` file. */
export function parseBibtex(source: string): ParseResult {
    const reader = new Reader(source);
    const macros = new Map(MONTHS.map((m) => [m, m]));
    const result: ParseResult = { references: [], errors: [] };

    for (;;) {
        const at = source.indexOf("@", reader.pos);
        if (at === -1) break;
        reader.pos = at + 1;

        // Text between entries is a comment in BibTeX, and may hold an "@"
        // (an email address, say). Only "@name{" or "@name(" starts an entry.
        const head = /^([A-Za-z]+)\s*[{(]/.exec(source.slice(reader.pos));
        if (!head) continue;

        let kind = "";
        let key = "";
        try {
            kind = reader.word().toLowerCase();
            const open = reader.peek();
            if (kind === "comment" || kind === "preamble") {
                if (open === "{") reader.delimited();
                continue;
            }
            reader.pos++;

            if (kind === "string") {
                const name = reader.word().toLowerCase();
                reader.expect("=");
                macros.set(name, reader.value(macros));
                continue;
            }

            key = reader.word();
            const fields = new Map<string, string>();
            while (reader.peek() === ",") {
                reader.pos++;
                const next = reader.peek();
                if (next === "}" || next === ")") break;
                const name = reader.word().toLowerCase();
                reader.expect("=");
                fields.set(name, reader.value(macros));
            }
            const close = reader.peek();
            if (close !== "}" && close !== ")") throw new Error("expected , or }");
            reader.pos++;

            result.references.push(toReference(kind, key, fields));
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            result.errors.push(`${key ? `"${key}"` : `@${kind || "entry"}`}: ${reason}`);
            // Carry on from the next line that starts an entry after this one
            // began: an unclosed brace may have read on to the end of the file.
            const next = source.slice(at + 1).search(/\n\s*@/);
            reader.pos = next === -1 ? source.length : at + 1 + next + 1;
        }
    }

    return result;
}
