/**
 * Citation key generation and BibTeX serialisation.
 *
 * Keys follow the BibTeX convention of `<first author surname><year>` with a
 * letter suffix on collision, which is what researchers expect to see in
 * `\cite{}` and what the LaTeX export will emit into refs.bib.
 */

export type ReferenceType =
    | "article"
    | "inproceedings"
    | "book"
    | "incollection"
    | "techreport"
    | "phdthesis"
    | "misc";

export interface ReferenceLike {
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
}

/**
 * BibTeX month macros. They are written unbraced — `month = jan` — because
 * that is what the .bst styles expect; a braced "1" would print as "1".
 */
const BIBTEX_MONTHS = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

/**
 * A group author — "{American Psychological Association}" — is braced so it is
 * never split into a surname and initials, following the BibTeX convention.
 */
function isGroupAuthor(author: string): boolean {
    return /^\{[^{}]+\}$/.test(author.trim());
}

/** Generational suffixes, which are never the surname. */
const NAME_SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;

/**
 * Surname from "Ashish Vaswani" or "Vaswani, Ashish"; the whole name for a
 * braced group author.
 */
export function surnameOf(author: string): string {
    const name = author.trim();
    if (!name) return "";
    if (isGroupAuthor(name)) return name.slice(1, -1).trim();

    if (name.includes(",")) {
        const parts = name.split(",").map((part) => part.trim());
        // "Alexander C. Evans, Jr." — the part after the comma is a suffix.
        if (parts.length === 2 && NAME_SUFFIX.test(parts[1] ?? "")) return surnameOf(parts[0] ?? "");
        // "Evans Jr., Alexander C." — drop the suffix from the family name.
        return (parts[0] ?? "").replace(/\s+(jr|sr|ii|iii|iv|v)\.?$/i, "");
    }
    const parts = name.split(/\s+/);
    // "Alexander C. Evans Jr." — a generational suffix is not the surname.
    if (parts.length > 2 && NAME_SUFFIX.test(parts[parts.length - 1] ?? "")) parts.pop();
    return parts[parts.length - 1] ?? "";
}

function keyRoot(authors: string[], year?: number): string {
    const surname = surnameOf(authors[0] ?? "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z]/g, "");

    return `${surname || "ref"}${year ?? ""}`;
}

/**
 * A key not already present in `taken`. Collisions get a, b, c... suffixes,
 * matching how reference managers disambiguate same-author-same-year entries.
 */
export function buildCitationKey(
    authors: string[],
    year: number | undefined,
    taken: Iterable<string>
): string {
    const existing = new Set(taken);
    const root = keyRoot(authors, year);

    if (!existing.has(root)) return root;

    // 26 letters, then fall back to numbers rather than looping forever.
    for (let i = 0; i < 26; i++) {
        const candidate = `${root}${String.fromCharCode(97 + i)}`;
        if (!existing.has(candidate)) return candidate;
    }
    for (let i = 2; ; i++) {
        const candidate = `${root}-${i}`;
        if (!existing.has(candidate)) return candidate;
    }
}

/**
 * Braces the capitals in a title so BibTeX styles cannot lowercase them.
 * Without this, "The TeXbook" renders as "The texbook" under many styles.
 */
function protectCapitals(title: string): string {
    return title.replace(/\b([A-Z][A-Za-z]*[A-Z][A-Za-z]*)\b/g, "{$1}");
}

function escapeBibtex(value: string): string {
    return value.replace(/[{}\\]/g, "\\$&").replace(/[&%$#_]/g, "\\$&");
}

/**
 * The `author` field. A group author keeps its braces — which is what stops
 * biblatex splitting "American Psychological Association" into a surname and
 * initials — and everything else is escaped as usual.
 */
function bibtexNames(authors: string[]): string {
    return authors
        .map((author) =>
            isGroupAuthor(author) ? `{${escapeBibtex(author.trim().slice(1, -1))}}` : escapeBibtex(author)
        )
        .join(" and ");
}

function monthMacro(month: number | undefined): string | undefined {
    if (!month || month < 1 || month > 12) return undefined;
    return BIBTEX_MONTHS[month - 1];
}

/** "2022-07-18" — the shape biblatex's `urldate` expects. */
function isoDate(timestamp: number | undefined): string | undefined {
    if (!timestamp) return undefined;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
}

/** Serialises one reference as a BibTeX entry. */
export function toBibtexEntry(reference: ReferenceLike): string {
    const fields: [string, string | undefined][] = [
        ["author", reference.authors.length ? bibtexNames(reference.authors) : undefined],
        ["title", protectCapitals(reference.title)],
        [
            reference.type === "inproceedings" || reference.type === "incollection"
                ? "booktitle"
                : "journal",
            reference.venue,
        ],
        ["editor", reference.editors?.length ? reference.editors.join(" and ") : undefined],
        ["edition", reference.edition],
        ["publisher", reference.publisher],
        ["address", reference.address],
        ["volume", reference.volume],
        ["number", reference.number],
        ["pages", reference.pages],
        ["year", reference.year ? String(reference.year) : undefined],
        ["month", monthMacro(reference.month)],
        ["doi", reference.doi],
        ["url", reference.url],
        ["urldate", isoDate(reference.accessed)],
    ];

    const body = fields
        .filter((entry): entry is [string, string] => Boolean(entry[1]))
        // `title` is pre-braced by protectCapitals and `author` by bibtexNames,
        // so escaping is skipped there. `month` is a macro name and must stay
        // outside braces to resolve.
        .map(([key, value]) => {
            if (key === "month") return `  ${key.padEnd(9)} = ${value}`;
            const rendered = key === "title" || key === "author" ? value : escapeBibtex(value);
            return `  ${key.padEnd(9)} = {${rendered}}`;
        })
        .join(",\n");

    return `@${reference.type}{${reference.citationKey},\n${body}\n}`;
}

export function toBibtexFile(references: ReferenceLike[]): string {
    return `${references.map(toBibtexEntry).join("\n\n")}\n`;
}

/** Capitals in a title that BibTeX would lowercase, for the .bib editor warning. */
export function unprotectedCapitals(title: string): string[] {
    const words = title.match(/\b[A-Z][A-Za-z]*[A-Z][A-Za-z]*\b/g) ?? [];
    return [...new Set(words)];
}
