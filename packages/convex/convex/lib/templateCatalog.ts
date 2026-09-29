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
    dateStyle?: "month-day-year" | "day-month-year";
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
    citationStyle: "ieee" | "apa" | "acm" | "vancouver" | "chicago" | "numeric" | "harvard" | "mla";
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
/*  APA 7 student paper skeleton                                               */
/* -------------------------------------------------------------------------- */

/**
 * An APA Style (7th edition) student paper, following APA's Student Paper
 * Setup Guide and Student Title Page Guide.
 *
 * Page order is title page, text, references, then any appendices, each
 * section starting on a new page. The editor reads three conventions from this
 * markup:
 *
 *  - Everything before the first page break is the **title page**: centred
 *    lines, the bold title three or four lines down, and one blank line between
 *    the title and the byline. The page break is an ordinary one, so it stays
 *    visible and can be moved.
 *  - APA heading levels map straight onto heading levels: Level 1 is `<h1>`
 *    (centred bold), Level 2 `<h2>`, and so on to Level 5. The repeated title at
 *    the top of the text doubles as the introduction's Level 1 heading, which
 *    is why there is no "Introduction" heading.
 *  - The References heading is followed by the generated reference list, so a
 *    new paper already has its alphabetical, hanging-indent list in place.
 *
 * Student papers carry no abstract, author note, or running head unless the
 * instructor asks, so none are included.
 */
function apaStudentPaper(): string {
    return [
        // Title page.
        "<h1>{{TITLE}}</h1>",
        "<p>{{AUTHORS}}</p>",
        "<p>{{AFFILIATION}}</p>",
        "<p>{{COURSE}}</p>",
        "<p>{{INSTRUCTOR}}</p>",
        "<p>{{DUE_DATE}}</p>",
        tip(
            "This is the title page; it ends at the page break below. Keep the title bold and in title case, and every other line plain. The page number 1 appears top right. Student papers need no running head unless your instructor asks for one."
        ),
        '<div data-page-break=""></div>',
        apaText(),
    ].join("");
}

/**
 * The pages every APA paper shares after its front matter: the text under the
 * repeated title, the references, and an optional appendix.
 */
function apaText(): string {
    return [
        // Text. The repeated title stands in for an "Introduction" heading.
        "<h1>{{TITLE}}</h1>",
        tip(
            'The paper title is repeated at the top of the first page of text. Do not add an "Introduction" heading: the opening paragraphs are understood to be the introduction. If your instructor asks for an abstract, put it on its own page after the title page, under a centred bold "Abstract" label.'
        ),
        "<p>Introduce the topic and explain why it matters.</p>",
        "<p>Summarise the relevant research and state the purpose of this paper.</p>",
        "<h1>Method</h1>",
        tip(
            "Start each main section with a Level 1 heading. Use Level 2 for subsections, and only when a section has two or more of them. Levels 3 to 5 are on the toolbar; Levels 4 and 5 run into their paragraph, so end them with a period."
        ),
        "<h2>Participants</h2>",
        "<p>Describe who took part and how they were recruited.</p>",
        "<h2>Procedure</h2>",
        "<p>Describe what was done, in the order it was done.</p>",
        "<h1>Results</h1>",
        tip(
            'Call out each table or figure in the text before it appears, for example "(see Table 1)". Tables and figures are numbered automatically, with the bold number and italic title above the table or image.'
        ),
        "<p>Report the findings.</p>",
        "<h1>Discussion</h1>",
        "<p>Interpret the findings, state the limitations, and suggest directions for future work.</p>",

        // References, on a new page.
        '<div data-page-break=""></div>',
        "<h1>References</h1>",
        '<div data-bibliography="true"></div>',
        tip(
            "Insert citations from the Refs panel. They appear in the text as (Author, Year) and are listed here alphabetically, double-spaced, with a hanging indent. Every work listed here should be cited in the text, and every work cited should be listed."
        ),

        // Appendix, on a new page.
        '<div data-page-break=""></div>',
        "<h1>Appendix</h1>",
        "<h1>Title of the Appendix</h1>",
        tip(
            'Optional — delete this page if the paper has no appendix. With more than one, label them "Appendix A", "Appendix B", and so on, and call each out in the text in that order.'
        ),
        "<p>Present supplementary material here.</p>",
    ].join("");
}

/**
 * An APA Style (7th edition) professional paper — the manuscript format for
 * submission to a journal.
 *
 * It differs from the student paper only in its front matter:
 *
 *  - a **running head** — a shortened title in capitals, top left of every
 *    page. It is the first block of the document (`<p data-running-head>`);
 *    the editor draws it in the page header and print repeats it on every page;
 *  - an **Author Note** in the bottom half of the title page, under a bold
 *    centred label (`data-apa-role="author-note"`), with ORCID iDs, affiliation
 *    changes, disclosures and a correspondence address;
 *  - an **Abstract** page under a bold centred label (`data-apa-role=
 *    "abstract"`), its first line flush left, followed by italic "Keywords:".
 *
 * There is no course, instructor or due date.
 */
function apaProfessionalPaper(): string {
    return [
        "<p data-running-head>{{RUNNING_HEAD}}</p>",

        // Title page.
        "<h1>{{TITLE}}</h1>",
        "<p>{{AUTHORS}}</p>",
        "<p>{{AFFILIATION}}</p>",
        tip(
            'The running head above is printed in capitals at the top left of every page; keep it to 50 characters. When authors have different affiliations, add superscript numerals after each name and before each affiliation, one affiliation per line.'
        ),
        '<h1 data-apa-role="author-note">Author Note</h1>',
        "<p>Give each author's ORCID iD here: Author Name https://orcid.org/0000-0000-0000-0000</p>",
        "<p>State any changes in affiliation since the research was done.</p>",
        "<p>Disclose conflicts of interest and funding, and thank anyone who helped.</p>",
        "<p>Correspondence concerning this article should be addressed to Author Name, Department, University, Street Address, City, Postcode. Email: name@example.com</p>",
        '<div data-page-break=""></div>',

        // Abstract.
        '<h1 data-apa-role="abstract">Abstract</h1>',
        "<p>{{ABSTRACT}}</p>",
        "<p><em>Keywords:</em> {{KEYWORDS}}</p>",
        tip(
            "One paragraph of up to 250 words, its first line flush left. List three to five keywords on the indented line after it."
        ),
        '<div data-page-break=""></div>',
        apaText(),
    ].join("");
}

const APA_PROFESSIONAL_SECTIONS: CatalogSection[] = [
    {
        key: "title-page",
        title: "Title Page",
        required: true,
        guidance: "Running head, title, byline, affiliations, and an author note in the bottom half.",
    },
    {
        key: "abstract",
        title: "Abstract",
        required: true,
        targetWords: 200,
        maxWords: 250,
        guidance: "One paragraph, first line flush left, followed by keywords.",
    },
    {
        key: "introduction",
        title: "Introduction",
        required: true,
        targetWords: 1000,
        guidance: 'Begins under the repeated paper title. No "Introduction" heading.',
    },
    { key: "method", title: "Method", required: true, targetWords: 1200 },
    { key: "results", title: "Results", required: true, targetWords: 1000 },
    { key: "discussion", title: "Discussion", required: true, targetWords: 1000 },
    {
        key: "references",
        title: "References",
        required: true,
        guidance: "Starts on a new page. Alphabetical, double-spaced, 0.5 in. hanging indent.",
    },
    { key: "appendix", title: "Appendix", required: false },
];

const APA_STUDENT_SECTIONS: CatalogSection[] = [
    {
        key: "title-page",
        title: "Title Page",
        required: true,
        guidance: "Title, authors, affiliation, course, instructor, and due date, centred.",
    },
    {
        key: "introduction",
        title: "Introduction",
        required: true,
        targetWords: 600,
        guidance: 'Begins under the repeated paper title. No "Introduction" heading.',
    },
    { key: "method", title: "Method", required: false, targetWords: 700 },
    { key: "results", title: "Results", required: false, targetWords: 600 },
    { key: "discussion", title: "Discussion", required: true, targetWords: 600 },
    {
        key: "references",
        title: "References",
        required: true,
        guidance: "Starts on a new page. Alphabetical, double-spaced, 0.5 in. hanging indent.",
    },
    {
        key: "appendix",
        title: "Appendix",
        required: false,
        guidance: "Each appendix on its own page, labelled and titled in bold, centred.",
    },
];

const APA_STUDENT_FIELDS: CatalogField[] = [
    {
        key: "authors",
        label: "Authors",
        type: "authors",
        required: false,
        placeholder: "{{AUTHORS}}",
        help: 'Full names as first name, middle initial, last name (e.g., Betsy R. Klein), separated by commas. "and" is added for you.',
    },
    {
        key: "affiliation",
        label: "Department and university",
        type: "text",
        required: false,
        placeholder: "{{AFFILIATION}}",
        help: "For example: Department of Psychology, University of Georgia",
    },
    {
        key: "course",
        label: "Course number and name",
        type: "text",
        required: false,
        placeholder: "{{COURSE}}",
        help: "As shown on course materials, for example: PSY 201: Introduction to Psychology",
    },
    {
        key: "instructor",
        label: "Instructor",
        type: "text",
        required: false,
        placeholder: "{{INSTRUCTOR}}",
        help: "With the instructor's preferred title, for example: Dr. Rowan J. Estes",
    },
    {
        key: "dueDate",
        label: "Assignment due date",
        type: "date",
        required: false,
        placeholder: "{{DUE_DATE}}",
        help: "Written out with the month spelled in full, e.g., October 18, 2025.",
    },
];

const APA_PROFESSIONAL_FIELDS: CatalogField[] = [
    {
        key: "runningHead",
        label: "Running head",
        type: "text",
        required: true,
        placeholder: "{{RUNNING_HEAD}}",
        help: "A shortened title of up to 50 characters, printed in capitals at the top of every page. No abbreviations; \"&\" is allowed.",
    },
    {
        key: "authors",
        label: "Authors",
        type: "authors",
        required: false,
        placeholder: "{{AUTHORS}}",
        help: 'Full names, separated by commas. "and" is added for you.',
    },
    {
        key: "affiliation",
        label: "Affiliation",
        type: "text",
        required: false,
        placeholder: "{{AFFILIATION}}",
        help: "Where the research was done: department, then institution. For example: Department of Nursing, Morrigan University",
    },
    abstractField,
    keywordsField,
];

/* -------------------------------------------------------------------------- */
/*  MLA 9 paper skeleton                                                       */
/* -------------------------------------------------------------------------- */

/**
 * An MLA Style (9th edition) research paper, following the MLA Handbook's
 * formatting guidance.
 *
 * MLA has no title page. The first page opens with a four-line heading, flush
 * left, then the title centred in plain type, then the text. The editor reads
 * three conventions from this markup:
 *
 *  - The **page header** is the author's last name followed by the page
 *    number, at the top right of every page. The name is the first block of
 *    the document (`<p data-running-head>`), the same node an APA running head
 *    uses; MLA's stylesheet draws it next to the page number instead of at
 *    the top left in capitals.
 *  - Paragraphs before the first `<h1>` are the **heading**: name, instructor,
 *    course, date, each on its own double-spaced line. The first `<h1>` is the
 *    title, centred and not bold.
 *  - The **Works Cited** list starts on a new page under a centred, plain
 *    heading, and is generated from the document's references: alphabetical,
 *    double-spaced, with a 0.5 in. hanging indent.
 *
 * The `mla` class option is what switches the editor and print to this page
 * layout (see `getPageGeometry`), so it stays with the document even if its
 * citation style is later changed.
 */
function mlaPaper(): string {
    return [
        "<p data-running-head>{{SURNAME}}</p>",

        // The heading, flush left on the first page.
        "<p>{{AUTHORS}}</p>",
        "<p>{{INSTRUCTOR}}</p>",
        "<p>{{COURSE}}</p>",
        "<p>{{DUE_DATE}}</p>",
        "<h1>{{TITLE}}</h1>",
        tip(
            "MLA papers have no title page. Your name, your instructor's name, the course, and the date sit flush left at the top of page one, and the title is centred below them in title case — not bold, italic, underlined, or in quotation marks. Your last name and the page number appear top right on every page."
        ),
        "<p>Open with the context your reader needs, and end the introduction with your thesis: the claim the rest of the paper argues.</p>",
        "<p>Develop each point in its own paragraph. When you quote or paraphrase a source, cite it in the sentence with the author's last name and the page number, for example (Moore 37).</p>",

        "<h2>Section Heading</h2>",
        tip(
            "Headings are optional in a short paper. If you use them, keep them in title case and consistent: Level 1 bold and flush left, Level 2 italic and flush left. Do not number them."
        ),
        "<p>Continue the argument here.</p>",
        tip(
            "Set a quotation longer than four lines of prose as a block quote from the toolbar: it is indented 0.5 in., double-spaced, and has no quotation marks. Put the citation after the final punctuation."
        ),

        "<h2>Conclusion</h2>",
        "<p>Draw the argument together and show why it matters, without only restating the thesis.</p>",

        // Works Cited, on a new page.
        '<div data-page-break=""></div>',
        "<h1>Works Cited</h1>",
        '<div data-bibliography="true"></div>',
        tip(
            'Insert citations from the Refs panel. They appear in the text as (Author Page) — (Moore 37), (Moore and Patel 48–50), (Moore et al. 59) — and are listed here alphabetically by author, double-spaced, with a hanging indent. A work with no author is cited and listed by its title.'
        ),
    ].join("");
}

const MLA_SECTIONS: CatalogSection[] = [
    {
        key: "heading",
        title: "Heading and Title",
        required: true,
        guidance:
            "Name, instructor, course, and date flush left on page one, then the title centred in plain type. No title page.",
    },
    {
        key: "introduction",
        title: "Introduction",
        required: true,
        targetWords: 250,
        guidance: "Ends with the thesis statement. No heading.",
    },
    {
        key: "body",
        title: "Body",
        required: true,
        targetWords: 1500,
        guidance: "One point per paragraph, each supported by cited evidence.",
    },
    { key: "conclusion", title: "Conclusion", required: true, targetWords: 250 },
    {
        key: "works-cited",
        title: "Works Cited",
        required: true,
        guidance:
            "Starts on a new page. Centred heading, alphabetical by author, double-spaced, 0.5 in. hanging indent.",
    },
];

const MLA_FIELDS: CatalogField[] = [
    {
        key: "authors",
        label: "Your name",
        type: "authors",
        required: false,
        placeholder: "{{AUTHORS}}",
        help: "Your full name as it should appear on the first line of the heading, for example: Jordan Moore.",
    },
    {
        key: "surname",
        label: "Last name for the page header",
        type: "text",
        required: false,
        placeholder: "{{SURNAME}}",
        help: "Printed before the page number at the top right of every page, for example: Moore.",
    },
    {
        key: "instructor",
        label: "Instructor",
        type: "text",
        required: false,
        placeholder: "{{INSTRUCTOR}}",
        help: "With the instructor's preferred title, for example: Professor Alvarez",
    },
    {
        key: "course",
        label: "Course",
        type: "text",
        required: false,
        placeholder: "{{COURSE}}",
        help: "Course name or number, for example: English 101",
    },
    {
        key: "dueDate",
        label: "Date",
        type: "date",
        required: false,
        placeholder: "{{DUE_DATE}}",
        help: "Written day first with the month in full, e.g., 5 March 2024.",
        dateStyle: "day-month-year",
    },
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
    {
        slug: "apa-student-paper",
        name: "APA Student Paper (7th ed.)",
        category: "assignments",
        description:
            "APA Style student paper: title page, double-spaced text with five heading levels, (Author, Year) citations, and an alphabetical reference list with hanging indents. Page numbers top right on every page.",
        tags: ["apa", "apa-7", "student", "psychology", "social-sciences", "essay"],
        official: false,
        content: apaStudentPaper(),
        sections: APA_STUDENT_SECTIONS,
        fields: APA_STUDENT_FIELDS,
        engine: "pdflatex",
        // biblatex-apa, which implements the APA 7 reference rules, needs biber.
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "apa7",
        classOptions: [
            { value: "stu", label: "Student paper", isDefault: true, group: "mode" },
            { value: "letterpaper", label: "US Letter", isDefault: true, group: "paper" },
            { value: "a4paper", label: "A4 paper", group: "paper" },
            { value: "12pt", label: "12pt body text", isDefault: true, group: "size" },
            { value: "11pt", label: "11pt body text", group: "size" },
        ],
        requiredPackages: ["biblatex", "csquotes", "babel", "graphicx"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://ctan.org/pkg/apa7",
            redistributable: true,
            notes: "apa7.cls is LPPL and community-maintained, not published by APA. Guidance text is written for this app from APA's public style rules.",
        },
        featured: true,
        order: 12,
    },
    {
        slug: "apa-professional-paper",
        name: "APA Professional Paper (7th ed.)",
        category: "journal-articles",
        description:
            "APA Style manuscript for journal submission: running head on every page, author note, abstract with keywords, five heading levels, (Author, Year) citations, and an alphabetical reference list.",
        tags: ["apa", "apa-7", "manuscript", "psychology", "social-sciences", "journal"],
        official: false,
        content: apaProfessionalPaper(),
        sections: APA_PROFESSIONAL_SECTIONS,
        fields: APA_PROFESSIONAL_FIELDS,
        engine: "pdflatex",
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "apa7",
        classOptions: [
            { value: "man", label: "Manuscript (professional paper)", isDefault: true, group: "mode" },
            { value: "letterpaper", label: "US Letter", isDefault: true, group: "paper" },
            { value: "a4paper", label: "A4 paper", group: "paper" },
            { value: "12pt", label: "12pt body text", isDefault: true, group: "size" },
            { value: "11pt", label: "11pt body text", group: "size" },
        ],
        requiredPackages: ["biblatex", "csquotes", "babel", "graphicx"],
        citationStyle: "apa",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://ctan.org/pkg/apa7",
            redistributable: true,
            notes: "apa7.cls is LPPL and community-maintained, not published by APA. Guidance text is written for this app from APA's public style rules.",
        },
        featured: true,
        order: 13,
    },
    {
        slug: "mla-paper",
        name: "MLA Paper (9th ed.)",
        category: "assignments",
        description:
            "MLA Style research paper: first-page heading instead of a title page, last name and page number top right, double-spaced text with 0.5 in. indents, (Author Page) citations, and an alphabetical Works Cited list with hanging indents.",
        tags: ["mla", "mla-9", "student", "humanities", "english", "essay", "works-cited"],
        official: false,
        content: mlaPaper(),
        sections: MLA_SECTIONS,
        fields: MLA_FIELDS,
        engine: "pdflatex",
        // biblatex-mla, which implements the MLA reference rules, needs biber.
        bibTool: "biber",
        passes: 3,
        entryFile: "main.tex",
        documentClass: "article",
        classOptions: [
            { value: "mla", label: "MLA page layout", isDefault: true, group: "format" },
            { value: "letterpaper", label: "US Letter", isDefault: true, group: "paper" },
            { value: "a4paper", label: "A4 paper", group: "paper" },
            { value: "12pt", label: "12pt body text", isDefault: true, group: "size" },
        ],
        requiredPackages: ["geometry", "setspace", "fancyhdr", "biblatex", "csquotes", "babel"],
        citationStyle: "mla",
        license: {
            spdx: "LPPL-1.3c",
            url: "https://www.latex-project.org/lppl/",
            redistributable: true,
            notes: "Standard article class; the MLA layout is set with geometry, setspace and fancyhdr, and references with the biblatex-mla style. Guidance text is written for this app from MLA's public style rules.",
        },
        featured: true,
        order: 14,
    },
];

export const templateCatalog = { categories: CATEGORIES, templates: TEMPLATES };
