/**
 * Helpers for turning a template skeleton into a document body.
 *
 * Skeletons are HTML containing `{{TOKEN}}` placeholders declared by the
 * template's `fields`. The create wizard collects values for those fields and
 * this module substitutes them.
 */

export type TemplateFieldType =
    | "text"
    | "textarea"
    | "authors"
    | "keywords"
    | "date";

export interface TemplateFieldLike {
    key: string;
    label: string;
    type: TemplateFieldType;
    required: boolean;
    placeholder: string;
    defaultValue?: string;
    help?: string;
    /** How a `date` field is written out. Month first unless a style asks otherwise. */
    dateStyle?: DateStyle;
}

/**
 * APA writes a date month first, "October 1, 2025"; MLA day first with no
 * commas, "1 October 2025".
 */
export type DateStyle = "month-day-year" | "day-month-year";

export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        // Strip combining diacritics so "Résumé" becomes "resume", not "rsum".
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

/**
 * Field values are typed by one user but rendered inside a document other
 * collaborators open, so they are escaped rather than trusted as HTML.
 */
export function escapeHtml(input: string): string {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Escapes a value for use inside a `{{TOKEN}}` slot, formatted by field type. */
function renderFieldValue(value: string, field: TemplateFieldLike): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const { type } = field;
    switch (type) {
        case "authors":
        case "keywords": {
            // Accept comma- or newline-separated input, render as a clean list.
            const parts = trimmed
                .split(/[,\n]/)
                .map((part) => part.trim())
                .filter(Boolean)
                .map(escapeHtml);
            return type === "authors" ? byline(parts) : parts.join(", ");
        }
        case "date":
            return escapeHtml(formatDate(trimmed, field.dateStyle));
        case "textarea":
            // Preserve paragraph breaks, since a textarea is multi-line.
            return trimmed
                .split(/\n{2,}/)
                .map((para) => escapeHtml(para).replace(/\n/g, "<br />"))
                .join("</p><p>");
        default:
            return escapeHtml(trimmed);
    }
}

/**
 * Names joined the way a byline reads: "A and B", or "A, B, and C" with the
 * serial comma. This is what APA's title page asks for, and it reads naturally
 * in every other template's author line too.
 */
function byline(names: string[]): string {
    if (names.length <= 1) return names[0] ?? "";
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

/**
 * A date picker's "2025-10-01" as "October 1, 2025" — month spelled out, as
 * APA asks for on the title page — or as "1 October 2025", MLA's heading
 * order. Anything else is left exactly as typed, so a date an author wrote in
 * their own country's format is not second-guessed.
 */
export function formatDate(value: string, style: DateStyle = "month-day-year"): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return value;
    const [, year, month, day] = match;
    const name = MONTHS[Number(month) - 1];
    if (!name) return value;
    return style === "day-month-year"
        ? `${Number(day)} ${name} ${year}`
        : `${name} ${Number(day)}, ${year}`;
}

/**
 * Replaces every field placeholder in `skeleton` with the supplied value,
 * falling back to the field's default and finally to an empty string.
 *
 * A `title` key is always accepted so templates can use `{{TITLE}}` without
 * declaring it as a field.
 */
export function applyFieldValues(
    skeleton: string,
    fields: TemplateFieldLike[],
    values: Record<string, string>
): string {
    let output = skeleton;

    for (const field of fields) {
        const raw = values[field.key] ?? field.defaultValue ?? "";
        const rendered = renderFieldValue(raw, field);
        output = replaceAllLiteral(output, field.placeholder, rendered);
    }

    if (values.title !== undefined) {
        output = replaceAllLiteral(output, "{{TITLE}}", escapeHtml(values.title));
    }

    return output;
}

/** Literal (non-regex) global replace, so `$&` in a value is not interpreted. */
function replaceAllLiteral(haystack: string, needle: string, replacement: string): string {
    if (!needle) return haystack;
    return haystack.split(needle).join(replacement);
}

/** Placeholders still present in a document body, for the readiness checklist. */
export function findUnresolvedPlaceholders(content: string): string[] {
    const matches = content.match(/\{\{[A-Z0-9_]+\}\}/g) ?? [];
    return [...new Set(matches)];
}
