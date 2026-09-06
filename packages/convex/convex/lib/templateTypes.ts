/**
 * Types shared between the seed catalog, the backend functions, and the apps.
 * Kept free of Convex imports so it can be pulled in from anywhere.
 */

export const TEMPLATE_CATEGORY_SLUGS = [
    "journal-articles",
    "theses",
    "cvs",
    "presentations",
    "assignments",
    "bibliographies",
    "books",
    "posters",
    "formal-letters",
    "newsletters",
    "calendars",
] as const;

export type TemplateCategoryValue = (typeof TEMPLATE_CATEGORY_SLUGS)[number];

export type Engine = "pdflatex" | "xelatex" | "lualatex";
export type BibTool = "biber" | "bibtex" | "none";
export type CitationStyle =
    | "ieee"
    | "apa"
    | "acm"
    | "vancouver"
    | "chicago"
    | "numeric";
