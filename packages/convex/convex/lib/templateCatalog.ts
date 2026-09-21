/**
 * Built-in template catalog.
 *
 * Checked into the repo so the default gallery is reviewable in git and can be
 * restored or replicated to another deployment; `seedTemplates` copies it into
 * the `templates` table, after which admins edit templates through the admin
 * panel rather than here.
 *
 * Licensing: all sample prose below is original. Publisher sample text (for
 * example ACM's "This document is a model and instructions for LaTeX...") is
 * covered by publisher terms even where the class file itself is LPPL, so it
 * is never copied. The `license` block on each entry describes the *class
 * file*, which is what a future compile service would need to resolve.
 *
 * Skeletons are constrained to the nodes the editor actually loads
 * (StarterKit + Underline + Link): headings, paragraphs, lists, blockquote,
 * code, and horizontal rules. Anything outside that schema, notably tables, is
 * silently dropped by TipTap on load.
 */

import type { TemplateCategoryValue } from "./templateTypes.js";

export interface CatalogSection {
    key: string;
    title: string;
    required: boolean;
    targetWords?: number;
    maxWords?: number;
    guidance?: string;
}

export interface CatalogField {
    key: string;
    label: string;
    type: "text" | "textarea" | "authors" | "keywords" | "date";
    required: boolean;
    placeholder: string;
    defaultValue?: string;
    help?: string;
}

export interface CatalogTemplate {
    slug: string;
    name: string;
    category: TemplateCategoryValue;
    description: string;
    tags: string[];
    official: boolean;
    publisher?: string;
    content: string;
    sections: CatalogSection[];
    fields: CatalogField[];
    engine: "pdflatex" | "xelatex" | "lualatex";
    bibTool: "biber" | "bibtex" | "none";
    passes: number;
    entryFile: string;
    documentClass: string;
    classOptions: { value: string; label: string; isDefault?: boolean; group?: string }[];
    requiredPackages: string[];
    latexSkeleton?: string;
    citationStyle: "ieee" | "apa" | "acm" | "vancouver" | "chicago" | "numeric";
    license: { spdx: string; url: string; redistributable: boolean; notes?: string };
    featured: boolean;
    order: number;
}

/* -------------------------------------------------------------------------- */
/*  Skeleton helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A guidance callout. Rendered as a blockquote so it is visible while drafting
 * and obvious to delete; the readiness check flags any that survive to export.
 */
const tip = (text: string) => `<blockquote><p><em>Guidance — ${text}</em></p></blockquote>`;

const CATEGORIES: {
    slug: TemplateCategoryValue;
    name: string;
    description: string;
    icon: string;
    order: number;
    isActive: boolean;
}[] = [
    {
        slug: "journal-articles",
        name: "Journal articles",
        description: "Conference and journal paper formats from the major publishers.",
        icon: "FileText",
        order: 1,
        isActive: true,
    },
    {
        slug: "theses",
        name: "Theses",
        description: "Multi-chapter dissertation and thesis scaffolds.",
        icon: "GraduationCap",
        order: 2,
        isActive: true,
    },
    {
        slug: "cvs",
        name: "CVs and résumés",
        description: "Academic and industry curriculum vitae layouts.",
        icon: "IdCard",
        order: 3,
        isActive: true,
    },
    {
        slug: "presentations",
        name: "Presentations",
        description: "Slide decks for talks, defences, and lab meetings.",
        icon: "Presentation",
        order: 4,
        isActive: true,
    },
    {
        slug: "assignments",
        name: "Assignments",
        description: "Coursework, problem sets, and lab reports.",
        icon: "NotebookPen",
        order: 5,
        isActive: true,
    },
    {
        slug: "bibliographies",
        name: "Bibliographies",
        description: "Reference-list and bibliography starters.",
        icon: "Library",
        order: 6,
        isActive: true,
    },
    {
        slug: "books",
        name: "Books",
        description: "Long-form book and monograph structures.",
        icon: "BookOpen",
        order: 7,
        isActive: true,
    },
    {
        slug: "posters",
        name: "Posters",
        description: "Conference poster layouts.",
        icon: "LayoutPanelTop",
        order: 8,
        isActive: true,
    },
    {
        slug: "formal-letters",
        name: "Formal letters",
        description: "Cover letters and formal correspondence.",
        icon: "Mail",
        order: 9,
        isActive: true,
    },
    {
        slug: "newsletters",
        name: "Newsletters",
        description: "Multi-column newsletter layouts.",
        icon: "Newspaper",
        order: 10,
        isActive: true,
    },
    {
        slug: "calendars",
        name: "Calendars",
        description: "Schedules and academic calendars.",
        icon: "Calendar",
        order: 11,
        isActive: true,
    },
];

/* -------------------------------------------------------------------------- */
/*  Reusable field sets                                                        */
/* -------------------------------------------------------------------------- */

const authorsField: CatalogField = {
    key: "authors",
    label: "Authors",
    type: "authors",
    required: false,
    placeholder: "{{AUTHORS}}",
    help: "Separate names with commas. You can add co-authors later.",
};

const affiliationField: CatalogField = {
    key: "affiliation",
    label: "Institution or department",
    type: "text",
    required: false,
    placeholder: "{{AFFILIATION}}",
};

const abstractField: CatalogField = {
    key: "abstract",
    label: "Abstract",
    type: "textarea",
    required: false,
    placeholder: "{{ABSTRACT}}",
    help: "Leave blank to start from the prompt in the document.",
};

const keywordsField: CatalogField = {
    key: "keywords",
    label: "Keywords",
    type: "keywords",
    required: false,
    placeholder: "{{KEYWORDS}}",
    help: "Three to five terms, comma separated.",
};

const IMRAD_SECTIONS: CatalogSection[] = [
    {
        key: "abstract",
        title: "Abstract",
        required: true,
        targetWords: 200,
        maxWords: 250,
        guidance: "Problem, method, result, and significance in one paragraph.",
    },
    {
        key: "introduction",
        title: "Introduction",
        required: true,
        targetWords: 800,
        guidance: "Motivate the problem, state the gap, then list your contributions.",
    },
    {
        key: "related-work",
        title: "Related Work",
        required: false,
        targetWords: 700,
        guidance: "Group prior work by approach, not chronologically.",
    },
    {
        key: "method",
        title: "Method",
        required: true,
        targetWords: 1200,
        guidance: "Enough detail that another group could reproduce this.",
    },
    {
        key: "results",
        title: "Results",
        required: true,
        targetWords: 900,
        guidance: "Report what you measured. Save interpretation for the discussion.",
    },
    {
        key: "discussion",
        title: "Discussion",
        required: false,
        targetWords: 600,
        guidance: "Interpret the results and state the limitations honestly.",
    },
    {
        key: "conclusion",
        title: "Conclusion",
        required: true,
        targetWords: 250,
        guidance: "Restate the contribution and name one concrete next step.",
    },
    { key: "references", title: "References", required: true },
];

/** Shared IMRaD body, used by the publisher templates that follow that shape. */
function imradBody(options: { relatedWork?: boolean; discussion?: boolean } = {}): string {
    const { relatedWork = true, discussion = true } = options;

    return [
        "<h2>Introduction</h2>",
        tip("Motivate the problem, state the gap in existing work, and close with a bulleted list of your contributions."),
        "<p>Describe the problem and why it matters.</p>",
        "<ul><li>First contribution.</li><li>Second contribution.</li><li>Third contribution.</li></ul>",
        relatedWork
            ? [
                  "<h2>Related Work</h2>",
                  tip("Group prior work by approach rather than by date, and say what each group leaves unresolved."),
                  "<p>Summarise the prior work this paper builds on.</p>",
              ].join("")
            : "",
        "<h2>Method</h2>",
        tip("Give enough detail for another group to reproduce this. Describe data, procedure, and evaluation measures."),
        "<h3>Data</h3><p>Describe the dataset or study population.</p>",
        "<h3>Procedure</h3><p>Describe the steps taken.</p>",
        "<h3>Evaluation</h3><p>Describe how success is measured.</p>",
        "<h2>Results</h2>",
        tip("Report what you measured here and leave interpretation for the discussion."),
        "<p>Present the findings.</p>",
        discussion
            ? [
                  "<h2>Discussion</h2>",
                  tip("Interpret the results, compare against prior work, and state the limitations plainly."),
                  "<p>Interpret the findings and state the limitations.</p>",
              ].join("")
            : "",
        "<h2>Conclusion</h2>",
        "<p>Restate the contribution and name a concrete next step.</p>",
        "<h2>References</h2>",
        tip("Insert citations from the Research panel; entries appear here automatically."),
    ].join("");
}

function titleBlock(includeAbstract = true, includeKeywords = true): string {
    return [
        "<h1>{{TITLE}}</h1>",
        "<p><strong>{{AUTHORS}}</strong></p>",
        "<p><em>{{AFFILIATION}}</em></p>",
        includeAbstract
            ? [
                  "<h2>Abstract</h2>",
                  tip("One paragraph: problem, method, result, significance. Most venues cap this at 250 words."),
                  "<p>{{ABSTRACT}}</p>",
              ].join("")
            : "",
        includeKeywords ? "<p><strong>Keywords:</strong> {{KEYWORDS}}</p>" : "",
        "<hr />",
    ].join("");
}

/* -------------------------------------------------------------------------- */
/*  IEEE skeleton                                                              */
/* -------------------------------------------------------------------------- */

/**
 * IEEE papers are laid out differently enough from the generic skeleton to be
 * worth their own builder.
 *
 * Three conventions are carried by the markup and read back by the editor:
 *
 *  - The horizontal rule after the author block is the **banner rule**. In a
 *    two-column format everything above it spans the measure, exactly as
 *    `\maketitle` does in IEEEtran, and the columns start below it. It is an
 *    ordinary rule, so an author who wants the abstract to span both columns
 *    can simply move it down.
 *  - The abstract and index terms are bold run-in paragraphs opening with an
 *    italic `Abstract—` / `Index Terms—`, not headings. That is how IEEE sets
 *    them, and it keeps them out of the section numbering.
 *  - Section numbers are never typed. `IEEEtran` numbers `\section` itself and
 *    so does the editor, from CSS counters, so the headings here carry no
 *    numerals. `data-unnumbered` marks the two sections IEEE leaves out of the
 *    sequence — the editor's `\section*`.
 */
function ieeeTitleBlock(): string {
    return [
        "<h1>{{TITLE}}</h1>",
        "<p>{{AUTHORS}}</p>",
        "<p><em>{{AFFILIATION}}</em></p>",
        "<p>City, Country</p>",
        "<p>name@example.com</p>",
        tip(
            "Everything above the dashed rule spans the full page width, like the title block of a printed IEEE paper. Everything below it flows into two columns. Move the rule if you want more or less in the banner."
        ),
        "<hr />",
    ].join("");
}

function ieeeBody(): string {
    return [
        // IEEE sets the whole abstract and index-terms block in bold, with the
        // run-in label additionally italic. Hence <strong> around all of it.
        "<p><strong><em>Abstract—</em>{{ABSTRACT}}</strong></p>",
        "<p><strong><em>Index Terms—</em>{{KEYWORDS}}</strong></p>",
        "<h2>Introduction</h2>",
        tip(
            "Motivate the problem, state the gap in existing work, and close with a list of your contributions. Section numbers are added automatically — do not type them."
        ),
        "<p>Describe the problem and why it matters.</p>",
        "<ul><li>First contribution.</li><li>Second contribution.</li><li>Third contribution.</li></ul>",
        "<h2>Related Work</h2>",
        tip("Group prior work by approach rather than by date, and say what each group leaves unresolved."),
        "<p>Summarise the prior work this paper builds on.</p>",
        "<h2>Method</h2>",
        tip("Give enough detail for another group to reproduce this. Subsections are lettered automatically: A, B, C."),
        "<h3>Data</h3>",
        "<p>Describe the dataset or study population.</p>",
        "<h3>Procedure</h3>",
        "<p>Describe the steps taken.</p>",
        "<h3>Evaluation</h3>",
        "<p>Describe how success is measured.</p>",
        "<h2>Results</h2>",
        tip("Report what you measured here and leave interpretation for the discussion."),
        "<p>Present the findings.</p>",
        "<h2>Discussion</h2>",
        tip("Interpret the results, compare against prior work, and state the limitations plainly."),
        "<p>Interpret the findings and state the limitations.</p>",
        "<h2>Conclusion</h2>",
        "<p>Restate the contribution and name a concrete next step.</p>",
        // IEEE sets both of these with \section*, so they sit outside the
        // numbered sequence and the sections above keep their numbers.
        '<h2 data-unnumbered="true">Acknowledgment</h2>',
        tip("Name funding sources and grant numbers. Unnumbered in the IEEE format."),
        "<p>Acknowledge funding and support here.</p>",
        '<h2 data-unnumbered="true">References</h2>',
        tip("Insert citations from the Research panel; entries appear here automatically."),
    ].join("");
}

/** Paper size options. Geometry needs one of these to pick A4 over US Letter. */
const ieeePaperOptions = [
    { value: "a4paper", label: "A4 paper", isDefault: true, group: "paper" },
    { value: "letterpaper", label: "US Letter", group: "paper" },
];

const IEEE_SECTIONS: CatalogSection[] = [
    ...IMRAD_SECTIONS.slice(0, -1),
    { key: "acknowledgment", title: "Acknowledgment", required: false, targetWords: 80 },
    { key: "references", title: "References", required: true },
];

/* -------------------------------------------------------------------------- */
/*  Templates                                                                  */
/* -------------------------------------------------------------------------- */

const TEMPLATES: CatalogTemplate[] = [
    {
        slug: "basic-article",
        name: "Basic Academic Article",
        category: "journal-articles",
        description:
            "A plain, venue-neutral research article with the standard IMRaD structure. The safe starting point when you do not yet know where you are submitting.",
        tags: ["article", "imrad", "general", "starter"],
        official: false,
        content: titleBlock() + imradBody(),
        sections: IMRAD_SECTIONS,
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "article",
        classOptions: [
            { value: "11pt", label: "11pt body text", isDefault: true, group: "size" },
            { value: "12pt", label: "12pt body text", group: "size" },
            { value: "a4paper", label: "A4 paper", isDefault: true, group: "paper" },
            { value: "letterpaper", label: "US Letter", group: "paper" },
        ],
        requiredPackages: ["graphicx", "amsmath", "amssymb", "geometry", "hyperref", "biblatex"],
        citationStyle: "numeric",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
            notes: "Stock LaTeX article class; sample prose written for this app.",
        },
        featured: true,
        order: 1,
    },
    {
        slug: "ieee-conference",
        name: "IEEE Conference Paper",
        category: "journal-articles",
        description:
            "Two-column IEEE conference format, with the banner title block, run-in abstract, and automatic Roman section numbering the format calls for.",
        tags: ["ieee", "conference", "two-column", "engineering"],
        official: true,
        publisher: "IEEE",
        content: ieeeTitleBlock() + ieeeBody(),
        sections: IEEE_SECTIONS,
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "bibtex",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "IEEEtran",
        classOptions: [
            {
                value: "conference",
                label: "Conference paper (two-column)",
                isDefault: true,
                group: "mode",
            },
            { value: "journal", label: "Journal / Transactions", group: "mode" },
            { value: "technote", label: "Technical note", group: "mode" },
            { value: "peerreview", label: "Peer review (single column)", group: "mode" },
            ...ieeePaperOptions,
        ],
        requiredPackages: ["cite", "amsmath", "amssymb", "amsfonts", "graphicx", "textcomp", "xcolor"],
        citationStyle: "ieee",
        license: {
            spdx: "LPPL-1.3",
            url: "https://ctan.org/pkg/ieeetran",
            redistributable: true,
            notes: "IEEEtran.cls is LPPL and may be redistributed unmodified. Take it from CTAN.",
        },
        featured: true,
        order: 2,
    },
    {
        slug: "ieee-journal",
        name: "IEEE Transactions Article",
        category: "journal-articles",
        description:
            "IEEE journal (Transactions) format — same class as the conference template with the journal option and a longer structure.",
        tags: ["ieee", "journal", "transactions"],
        official: true,
        publisher: "IEEE",
        content: ieeeTitleBlock() + ieeeBody(),
        sections: IEEE_SECTIONS,
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "bibtex",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "IEEEtran",
        classOptions: [
            { value: "journal", label: "Journal / Transactions", isDefault: true, group: "mode" },
            { value: "conference", label: "Conference paper", group: "mode" },
            ...ieeePaperOptions,
        ],
        requiredPackages: ["cite", "amsmath", "amssymb", "graphicx", "textcomp", "xcolor"],
        citationStyle: "ieee",
        license: {
            spdx: "LPPL-1.3",
            url: "https://ctan.org/pkg/ieeetran",
            redistributable: true,
        },
        featured: false,
        order: 3,
    },
    {
        slug: "acm-sigconf",
        name: "ACM Conference Paper (sigconf)",
        category: "journal-articles",
        description:
            "ACM proceedings format. Requires CCS concept tags and a copyright block before it will compile as LaTeX.",
        tags: ["acm", "conference", "sigconf", "computer-science"],
        official: true,
        publisher: "ACM",
        content:
            titleBlock() +
            [
                "<h2>CCS Concepts</h2>",
                tip(
                    "ACM requires classification tags from the ACM Computing Classification System. Generate them at dl.acm.org/ccs and paste the concepts here."
                ),
                "<p>List your CCS concepts.</p>",
            ].join("") +
            imradBody() +
            "<h2>Acknowledgments</h2><p>Acknowledge funding and support here.</p>",
        sections: [
            { key: "abstract", title: "Abstract", required: true, targetWords: 200, maxWords: 250 },
            {
                key: "ccs",
                title: "CCS Concepts",
                required: true,
                guidance: "ACM will not accept a submission without classification tags.",
            },
            ...IMRAD_SECTIONS.slice(1, -1),
            { key: "acknowledgments", title: "Acknowledgments", required: false },
            { key: "references", title: "References", required: true },
        ],
        fields: [
            authorsField,
            affiliationField,
            abstractField,
            keywordsField,
            {
                key: "conference",
                label: "Conference name",
                type: "text",
                required: false,
                placeholder: "{{CONFERENCE}}",
                help: "For example: CHI '26. Needed for the copyright block on export.",
            },
        ],
        engine: "pdflatex",
        bibTool: "bibtex",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "acmart",
        classOptions: [
            { value: "sigconf", label: "Conference proceedings", isDefault: true, group: "format" },
            { value: "acmsmall", label: "ACM journal (small)", group: "format" },
            { value: "acmlarge", label: "ACM journal (large)", group: "format" },
            { value: "acmtog", label: "TOG / SIGGRAPH", group: "format" },
            { value: "manuscript", label: "Single-column review copy", group: "format" },
        ],
        requiredPackages: ["booktabs", "libertine", "newtxmath", "environ", "totpages", "hyperxmp"],
        citationStyle: "acm",
        license: {
            spdx: "LPPL-1.3",
            url: "https://ctan.org/pkg/acmart",
            redistributable: true,
            notes: "The acmart class is LPPL; ACM's own sample text is not redistributable and is not used here.",
        },
        featured: true,
        order: 4,
    },
    {
        slug: "springer-lncs",
        name: "Springer LNCS Paper",
        category: "journal-articles",
        description:
            "Lecture Notes in Computer Science, used by a large number of CS conferences.",
        tags: ["springer", "lncs", "conference", "computer-science"],
        official: true,
        publisher: "Springer",
        content:
            titleBlock() +
            imradBody() +
            [
                "<h2>Credits</h2>",
                tip("LNCS expects an acknowledgements paragraph and a competing-interests declaration."),
                "<p><strong>Acknowledgements.</strong> Name funding sources here.</p>",
                "<p><strong>Disclosure of Interests.</strong> The authors declare no competing interests.</p>",
            ].join(""),
        sections: [
            {
                key: "abstract",
                title: "Abstract",
                required: true,
                targetWords: 200,
                maxWords: 250,
                guidance: "LNCS asks for 150–250 words.",
            },
            ...IMRAD_SECTIONS.slice(1, -1),
            { key: "credits", title: "Credits", required: true },
            { key: "references", title: "References", required: true },
        ],
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "bibtex",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "llncs",
        classOptions: [
            { value: "runningheads", label: "Running heads", isDefault: true },
        ],
        requiredPackages: ["graphicx", "fontenc"],
        citationStyle: "numeric",
        license: {
            spdx: "LicenseRef-Springer-LNCS",
            url: "https://www.springer.com/gp/computer-science/lncs/conference-proceedings-guidelines",
            redistributable: false,
            notes: "Springer restricts redistribution of llncs.cls. Fetch it from Springer at export time rather than vendoring it.",
        },
        featured: false,
        order: 5,
    },
    {
        slug: "elsevier-article",
        name: "Elsevier Journal Article",
        category: "journal-articles",
        description:
            "Elsevier's elsarticle format, with the front-matter block used across their journal portfolio.",
        tags: ["elsevier", "journal", "elsarticle"],
        official: true,
        publisher: "Elsevier",
        content:
            titleBlock() +
            [
                "<h2>Highlights</h2>",
                tip("Elsevier asks for three to five bullet points of at most 85 characters each."),
                "<ul><li>First highlight.</li><li>Second highlight.</li><li>Third highlight.</li></ul>",
            ].join("") +
            imradBody(),
        sections: [
            { key: "abstract", title: "Abstract", required: true, targetWords: 200, maxWords: 250 },
            {
                key: "highlights",
                title: "Highlights",
                required: true,
                guidance: "Three to five bullets, 85 characters each.",
            },
            ...IMRAD_SECTIONS.slice(1),
        ],
        fields: [
            authorsField,
            affiliationField,
            abstractField,
            keywordsField,
            {
                key: "journal",
                label: "Target journal",
                type: "text",
                required: false,
                placeholder: "{{JOURNAL}}",
            },
        ],
        engine: "pdflatex",
        bibTool: "bibtex",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "elsarticle",
        classOptions: [
            { value: "preprint", label: "Preprint (single column)", isDefault: true, group: "mode" },
            { value: "final,5p,times,twocolumn", label: "Journal look (two column)", group: "mode" },
        ],
        requiredPackages: ["lineno", "graphicx", "amsmath"],
        citationStyle: "numeric",
        license: {
            spdx: "LPPL-1.3",
            url: "https://ctan.org/pkg/elsarticle",
            redistributable: true,
        },
        featured: false,
        order: 6,
    },
    {
        slug: "literature-review",
        name: "Literature Review",
        category: "journal-articles",
        description:
            "A structured review paper with a documented search strategy — built for the systematic-review workflow rather than IMRaD.",
        tags: ["review", "survey", "systematic", "prisma"],
        official: false,
        content:
            titleBlock() +
            [
                "<h2>Introduction</h2>",
                tip("State the review question and why a review is needed now."),
                "<p>Introduce the field and the question this review answers.</p>",
                "<h2>Search Strategy</h2>",
                tip(
                    "Record databases searched, the exact query strings, date range, and inclusion and exclusion criteria. Reviewers check this first."
                ),
                "<h3>Databases and queries</h3><p>List each database and the query used.</p>",
                "<h3>Inclusion criteria</h3><ul><li>First criterion.</li></ul>",
                "<h3>Exclusion criteria</h3><ul><li>First criterion.</li></ul>",
                "<h2>Thematic Synthesis</h2>",
                tip("Organise by theme, not one-paper-per-paragraph. Each subsection should make an argument."),
                "<h3>Theme one</h3><p>Synthesise the work in this theme.</p>",
                "<h3>Theme two</h3><p>Synthesise the work in this theme.</p>",
                "<h2>Gaps and Open Questions</h2>",
                "<p>Name what the literature has not settled.</p>",
                "<h2>Conclusion</h2>",
                "<p>Summarise the state of the field.</p>",
                "<h2>References</h2>",
                tip("Insert citations from the Research panel; entries appear here automatically."),
            ].join(""),
        sections: [
            { key: "abstract", title: "Abstract", required: true, targetWords: 200, maxWords: 250 },
            { key: "introduction", title: "Introduction", required: true, targetWords: 700 },
            {
                key: "search-strategy",
                title: "Search Strategy",
                required: true,
                targetWords: 600,
                guidance: "Databases, query strings, date range, inclusion and exclusion criteria.",
            },
            { key: "synthesis", title: "Thematic Synthesis", required: true, targetWords: 2500 },
            { key: "gaps", title: "Gaps and Open Questions", required: true, targetWords: 500 },
            { key: "conclusion", title: "Conclusion", required: true, targetWords: 300 },
            { key: "references", title: "References", required: true },
        ],
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "article",
        classOptions: [{ value: "11pt", label: "11pt body text", isDefault: true }],
        requiredPackages: ["graphicx", "geometry", "hyperref", "biblatex"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
        },
        featured: true,
        order: 7,
    },
    {
        slug: "thesis-dissertation",
        name: "Thesis / Dissertation",
        category: "theses",
        description:
            "A chapter-based thesis scaffold with front matter, five standard chapters, and appendices. Adapt to your institution's regulations.",
        tags: ["thesis", "dissertation", "phd", "masters", "report"],
        official: false,
        content: [
            "<h1>{{TITLE}}</h1>",
            "<p><strong>{{AUTHORS}}</strong></p>",
            "<p><em>{{AFFILIATION}}</em></p>",
            "<p>{{DEGREE}} — {{SUBMISSION_DATE}}</p>",
            "<hr />",
            "<h2>Declaration</h2>",
            tip("Most institutions mandate exact wording here. Copy it from your regulations."),
            "<p>I declare that this thesis is my own work.</p>",
            "<h2>Abstract</h2>",
            "<p>{{ABSTRACT}}</p>",
            "<h2>Acknowledgements</h2>",
            "<p>Thank supervisors, funders, and collaborators.</p>",
            "<hr />",
            "<h2>Chapter 1 — Introduction</h2>",
            tip("Set out the problem, the research questions, and the structure of the thesis."),
            "<h3>Background</h3><p>Introduce the field.</p>",
            "<h3>Research questions</h3><ol><li>First question.</li></ol>",
            "<h3>Contributions</h3><ul><li>First contribution.</li></ul>",
            "<h3>Thesis structure</h3><p>Summarise each chapter in a sentence.</p>",
            "<h2>Chapter 2 — Literature Review</h2>",
            tip("Organise by theme and end with the gap your work addresses."),
            "<p>Review the relevant literature.</p>",
            "<h2>Chapter 3 — Methodology</h2>",
            tip("Justify your choices, do not only describe them. Include ethics approval if applicable."),
            "<h3>Research design</h3><p>Describe the design.</p>",
            "<h3>Data collection</h3><p>Describe collection.</p>",
            "<h3>Analysis</h3><p>Describe analysis.</p>",
            "<h2>Chapter 4 — Results</h2>",
            "<p>Present the findings.</p>",
            "<h2>Chapter 5 — Discussion and Conclusion</h2>",
            "<h3>Discussion</h3><p>Interpret the findings.</p>",
            "<h3>Limitations</h3><p>State the limitations.</p>",
            "<h3>Future work</h3><p>Name the next steps.</p>",
            "<h2>References</h2>",
            tip("Insert citations from the Research panel; entries appear here automatically."),
            "<h2>Appendices</h2>",
            "<p>Supporting material, instruments, and code listings.</p>",
        ].join(""),
        sections: [
            { key: "declaration", title: "Declaration", required: true },
            { key: "abstract", title: "Abstract", required: true, targetWords: 300, maxWords: 500 },
            { key: "acknowledgements", title: "Acknowledgements", required: false },
            { key: "ch1-introduction", title: "Chapter 1 — Introduction", required: true, targetWords: 4000 },
            { key: "ch2-literature", title: "Chapter 2 — Literature Review", required: true, targetWords: 8000 },
            { key: "ch3-methodology", title: "Chapter 3 — Methodology", required: true, targetWords: 6000 },
            { key: "ch4-results", title: "Chapter 4 — Results", required: true, targetWords: 7000 },
            { key: "ch5-discussion", title: "Chapter 5 — Discussion and Conclusion", required: true, targetWords: 5000 },
            { key: "references", title: "References", required: true },
            { key: "appendices", title: "Appendices", required: false },
        ],
        fields: [
            authorsField,
            affiliationField,
            abstractField,
            {
                key: "degree",
                label: "Degree",
                type: "text",
                required: false,
                placeholder: "{{DEGREE}}",
                defaultValue: "Doctor of Philosophy",
            },
            {
                key: "submissionDate",
                label: "Submission date",
                type: "date",
                required: false,
                placeholder: "{{SUBMISSION_DATE}}",
            },
        ],
        engine: "pdflatex",
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "report",
        classOptions: [
            { value: "12pt", label: "12pt body text", isDefault: true, group: "size" },
            { value: "oneside", label: "Single sided", isDefault: true, group: "binding" },
            { value: "twoside", label: "Double sided", group: "binding" },
        ],
        requiredPackages: ["geometry", "setspace", "graphicx", "biblatex", "hyperref"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
            notes: "Stock report class. University-specific classes must be added as separate templates.",
        },
        featured: true,
        order: 8,
    },
    {
        slug: "beamer-presentation",
        name: "Conference Presentation",
        category: "presentations",
        description:
            "A talk structure that fits a 12–15 minute conference slot, one heading per slide.",
        tags: ["beamer", "slides", "talk", "defence"],
        official: false,
        content: [
            "<h1>{{TITLE}}</h1>",
            "<p><strong>{{AUTHORS}}</strong></p>",
            "<p><em>{{AFFILIATION}}</em> — {{EVENT}}</p>",
            "<hr />",
            tip("One heading below is one slide. Aim for roughly one slide per minute of speaking time."),
            "<h2>Outline</h2><ul><li>Motivation</li><li>Method</li><li>Results</li><li>Conclusion</li></ul>",
            "<h2>Motivation</h2><ul><li>Why this problem matters.</li></ul>",
            "<h2>The Gap</h2><ul><li>What existing work does not solve.</li></ul>",
            "<h2>Our Approach</h2><ul><li>The idea in one sentence.</li></ul>",
            "<h2>Method</h2><ul><li>Key step one.</li><li>Key step two.</li></ul>",
            "<h2>Results</h2><ul><li>Headline number.</li><li>Comparison against the baseline.</li></ul>",
            "<h2>Limitations</h2><ul><li>Be upfront; it pre-empts the hostile question.</li></ul>",
            "<h2>Conclusion</h2><ul><li>One takeaway you want remembered.</li></ul>",
            "<h2>Thank You / Questions</h2><p>Contact details.</p>",
            "<h2>Backup Slides</h2>",
            tip("Keep extra detail here for the question session rather than in the main deck."),
        ].join(""),
        sections: [
            { key: "outline", title: "Outline", required: true },
            { key: "motivation", title: "Motivation", required: true },
            { key: "gap", title: "The Gap", required: true },
            { key: "approach", title: "Our Approach", required: true },
            { key: "method", title: "Method", required: true },
            { key: "results", title: "Results", required: true },
            { key: "limitations", title: "Limitations", required: false },
            { key: "conclusion", title: "Conclusion", required: true },
            { key: "backup", title: "Backup Slides", required: false },
        ],
        fields: [
            authorsField,
            affiliationField,
            {
                key: "event",
                label: "Event or venue",
                type: "text",
                required: false,
                placeholder: "{{EVENT}}",
            },
        ],
        engine: "pdflatex",
        bibTool: "none",
        passes: 2,
        entryFile: "main.tex",
        documentClass: "beamer",
        classOptions: [
            { value: "aspectratio=169", label: "16:9 widescreen", isDefault: true, group: "ratio" },
            { value: "aspectratio=43", label: "4:3", group: "ratio" },
        ],
        requiredPackages: ["beamer", "graphicx"],
        citationStyle: "numeric",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://ctan.org/pkg/beamer",
            redistributable: true,
        },
        featured: false,
        order: 9,
    },
    {
        slug: "lab-report",
        name: "Lab Report / Assignment",
        category: "assignments",
        description:
            "Coursework and lab report structure with aim, method, results, and analysis.",
        tags: ["assignment", "lab", "coursework", "student"],
        official: false,
        content: [
            "<h1>{{TITLE}}</h1>",
            "<p><strong>{{AUTHORS}}</strong> — {{STUDENT_ID}}</p>",
            "<p><em>{{COURSE}}</em> — due {{DUE_DATE}}</p>",
            "<hr />",
            "<h2>Aim</h2>",
            tip("One or two sentences stating what this experiment set out to determine."),
            "<p>State the aim.</p>",
            "<h2>Background Theory</h2><p>Give the relevant theory and equations.</p>",
            "<h2>Apparatus and Materials</h2><ul><li>First item.</li></ul>",
            "<h2>Method</h2>",
            tip("Write in the past tense and passive voice: what was done, not what to do."),
            "<ol><li>First step.</li><li>Second step.</li></ol>",
            "<h2>Results</h2>",
            tip("Present raw measurements here. Keep interpretation for the analysis."),
            "<p>Record the measurements.</p>",
            "<h2>Analysis and Discussion</h2>",
            "<p>Interpret the results and quantify the sources of error.</p>",
            "<h2>Conclusion</h2><p>Answer the aim directly.</p>",
            "<h2>References</h2>",
            tip("Insert citations from the Research panel; entries appear here automatically."),
        ].join(""),
        sections: [
            { key: "aim", title: "Aim", required: true, targetWords: 60 },
            { key: "background", title: "Background Theory", required: false, targetWords: 400 },
            { key: "apparatus", title: "Apparatus and Materials", required: true },
            { key: "method", title: "Method", required: true, targetWords: 400 },
            { key: "results", title: "Results", required: true, targetWords: 400 },
            { key: "analysis", title: "Analysis and Discussion", required: true, targetWords: 600 },
            { key: "conclusion", title: "Conclusion", required: true, targetWords: 150 },
            { key: "references", title: "References", required: false },
        ],
        fields: [
            authorsField,
            {
                key: "studentId",
                label: "Student ID",
                type: "text",
                required: false,
                placeholder: "{{STUDENT_ID}}",
            },
            {
                key: "course",
                label: "Course code and title",
                type: "text",
                required: false,
                placeholder: "{{COURSE}}",
            },
            {
                key: "dueDate",
                label: "Due date",
                type: "date",
                required: false,
                placeholder: "{{DUE_DATE}}",
            },
        ],
        engine: "pdflatex",
        bibTool: "biber",
        passes: 2,
        entryFile: "main.tex",
        documentClass: "article",
        classOptions: [{ value: "12pt", label: "12pt body text", isDefault: true }],
        requiredPackages: ["fancyhdr", "enumitem", "graphicx", "amsmath"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
        },
        featured: false,
        order: 10,
    },
    {
        slug: "research-proposal",
        name: "Research Proposal",
        category: "assignments",
        description:
            "Grant and postgraduate proposal structure: problem, questions, method, timeline, and expected outcomes.",
        tags: ["proposal", "grant", "funding", "phd"],
        official: false,
        content:
            titleBlock(false, true) +
            [
                "<h2>Summary</h2>",
                tip("Write this last. Reviewers often read only this page."),
                "<p>{{ABSTRACT}}</p>",
                "<h2>Problem Statement</h2><p>State the problem and why it is unsolved.</p>",
                "<h2>Research Questions</h2><ol><li>First question.</li><li>Second question.</li></ol>",
                "<h2>Literature Context</h2><p>Position the work against existing research.</p>",
                "<h2>Proposed Methodology</h2>",
                tip("Tie each method back to a specific research question."),
                "<p>Describe the approach.</p>",
                "<h2>Timeline and Milestones</h2>",
                tip("Break the work into quarters with a checkable deliverable in each."),
                "<ul><li>Months 1–3: deliverable.</li><li>Months 4–6: deliverable.</li></ul>",
                "<h2>Expected Outcomes</h2><p>State what will exist at the end that does not exist now.</p>",
                "<h2>Ethical Considerations</h2><p>Note approvals needed and data handling.</p>",
                "<h2>Budget</h2><p>Summarise the costs.</p>",
                "<h2>References</h2>",
                tip("Insert citations from the Research panel; entries appear here automatically."),
            ].join(""),
        sections: [
            { key: "summary", title: "Summary", required: true, targetWords: 300, maxWords: 500 },
            { key: "problem", title: "Problem Statement", required: true, targetWords: 500 },
            { key: "questions", title: "Research Questions", required: true },
            { key: "literature", title: "Literature Context", required: true, targetWords: 900 },
            { key: "methodology", title: "Proposed Methodology", required: true, targetWords: 1000 },
            { key: "timeline", title: "Timeline and Milestones", required: true },
            { key: "outcomes", title: "Expected Outcomes", required: true, targetWords: 400 },
            { key: "ethics", title: "Ethical Considerations", required: false },
            { key: "budget", title: "Budget", required: false },
            { key: "references", title: "References", required: true },
        ],
        fields: [authorsField, affiliationField, abstractField, keywordsField],
        engine: "pdflatex",
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "article",
        classOptions: [{ value: "11pt", label: "11pt body text", isDefault: true }],
        requiredPackages: ["geometry", "hyperref", "biblatex", "graphicx"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
        },
        featured: false,
        order: 11,
    },
];

export const templateCatalog = { categories: CATEGORIES, templates: TEMPLATES };
