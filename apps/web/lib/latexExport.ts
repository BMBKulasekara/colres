/**
 * LaTeX export: the editor's document as `main.tex`, plus `references.bib`.
 *
 * Works on the editor's JSON (`editor.getJSON()`) rather than its HTML, so it
 * runs in Node for tests and never needs a DOM. Numbers are not carried over:
 * sections, figures, tables and citations are emitted as `\section`, `\label`,
 * `\ref` and `\cite`, and LaTeX numbers them itself, the same way the editor's
 * numbering plugins do on screen.
 *
 * Images are fetched by the caller (see `latexDownload.ts`) and passed in as a
 * map from `src` to their path in the zip, so this module stays synchronous.
 */

import { type ReferenceLike, toBibtexFile } from '@repo/convex/references/bibtex';
import type { CitationStyle } from './citationFormat';

/** The subset of TipTap's `JSONContent` this module reads. */
export interface DocNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

/** The document's compilation contract, as stored in `templateSnapshot`. */
export interface LatexTemplate {
  documentClass: string;
  classOptions: string[];
  engine: 'pdflatex' | 'xelatex' | 'lualatex';
  bibTool: 'biber' | 'bibtex' | 'none';
  citationStyle: CitationStyle;
}

export interface LatexExportInput {
  title: string;
  doc: DocNode;
  /** Absent for a blank document, which exports as a plain `article`. */
  template?: LatexTemplate;
  /** The style in effect: the document's override, else the template's. */
  citationStyle: CitationStyle;
  references: ReferenceLike[];
  /** Image `src` to its path inside the zip, for images that were fetched. */
  images?: Map<string, string>;
}

export interface LatexExport {
  /** Path in the zip to file contents. */
  files: Record<string, string>;
  /** Things the author should check, also written to the zip's README. */
  warnings: string[];
}

const DEFAULT_TEMPLATE: LatexTemplate = {
  documentClass: 'article',
  classOptions: [],
  engine: 'pdflatex',
  bibTool: 'biber',
  citationStyle: 'numeric',
};

/* ------------------------------------------------------------------------- */
/* Escaping                                                                  */
/* ------------------------------------------------------------------------- */

const LATEX_SPECIALS: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '{': '\\{',
  '}': '\\}',
  '&': '\\&',
  '%': '\\%',
  $: '\\$',
  '#': '\\#',
  _: '\\_',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
};

/** Plain text made safe to place anywhere in a LaTeX body. */
export function escapeLatex(text: string): string {
  return text.replace(/[\\{}&%$#_~^]/g, (ch) => LATEX_SPECIALS[ch] ?? ch).replace(/\u00a0/g, '~');
}

/** A URL for `\href`/`\url`, where only `%`, `#` and `\` need escaping. */
function escapeUrl(url: string): string {
  return url.replace(/[\\%#]/g, (ch) => `\\${ch}`);
}

/** Ids from the editor are UUID-like; labels must avoid LaTeX's specials. */
function labelFor(kind: 'figure' | 'table', floatId: string): string {
  return `${kind === 'figure' ? 'fig' : 'tab'}:${floatId.replace(/[^A-Za-z0-9-]/g, '-')}`;
}

/* ------------------------------------------------------------------------- */
/* Bibliography                                                              */
/* ------------------------------------------------------------------------- */

/** biblatex styles that ship with TeX Live, and so with Overleaf. */
const BIBLATEX_STYLES: Record<CitationStyle, string> = {
  ieee: 'ieee',
  apa: 'apa',
  acm: 'numeric-comp',
  vancouver: 'vancouver',
  chicago: 'authoryear',
  harvard: 'authoryear',
  mla: 'mla',
  numeric: 'numeric',
};

/** BibTeX styles by citation style, used when the class has no own `.bst`. */
const BIBTEX_STYLES: Record<CitationStyle, string> = {
  ieee: 'IEEEtran',
  apa: 'apalike',
  acm: 'ACM-Reference-Format',
  vancouver: 'vancouver',
  chicago: 'apalike',
  harvard: 'apalike',
  mla: 'apalike',
  numeric: 'plain',
};

/** The `.bst` a publisher class is designed for. */
const CLASS_BIBTEX_STYLES: Record<string, string> = {
  IEEEtran: 'IEEEtran',
  acmart: 'ACM-Reference-Format',
  llncs: 'splncs04',
  elsarticle: 'elsarticle-num',
};

/** Classes that load natbib themselves, and so offer `\citet`. */
const NATBIB_CLASSES = new Set(['acmart', 'elsarticle']);

/** Classes that load hyperref themselves; loading it again can clash. */
const HYPERREF_CLASSES = new Set(['acmart', 'beamer']);

interface BibSetup {
  tool: 'biber' | 'bibtex';
  /** Lines for the preamble. */
  preamble: string[];
  /** The command that prints the reference list. */
  print: (title?: string) => string;
  /** `\cite`-family command for a narrative ("Smith (2020) found") mention. */
  narrative: string;
}

function bibSetup(template: LatexTemplate, style: CitationStyle): BibSetup {
  // A template with no bibliography tool still gets one if the author cites:
  // otherwise every \cite would print as "?".
  const tool = template.bibTool === 'none' ? 'bibtex' : template.bibTool;

  if (tool === 'biber') {
    return {
      tool,
      preamble: [
        `\\usepackage[backend=biber,style=${BIBLATEX_STYLES[style]}]{biblatex}`,
        '\\addbibresource{references.bib}',
      ],
      print: (title) =>
        title ? `\\printbibliography[title={${escapeLatex(title)}}]` : '\\printbibliography',
      narrative: '\\textcite',
    };
  }

  // Keep the publisher's own .bst unless the author switched style.
  const bst =
    style === template.citationStyle && CLASS_BIBTEX_STYLES[template.documentClass]
      ? CLASS_BIBTEX_STYLES[template.documentClass]
      : BIBTEX_STYLES[style];

  return {
    tool,
    preamble: [],
    print: () => `\\bibliographystyle{${bst}}\n\\bibliography{references}`,
    narrative: NATBIB_CLASSES.has(template.documentClass) ? '\\citet' : '\\cite',
  };
}

/* ------------------------------------------------------------------------- */
/* Conversion                                                                */
/* ------------------------------------------------------------------------- */

const HEADING_COMMANDS = ['section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph'];

const ABSTRACT_TITLE = /^\s*abstract\s*\.?\s*$/i;
const REFERENCES_TITLE = /^\s*(references|bibliography|works cited|reference list)\s*\.?\s*$/i;

interface Context {
  bib: BibSetup;
  figurePrefix: string;
  /** Float id to its kind, collected before conversion so forward refs work. */
  floats: Map<string, 'figure' | 'table'>;
  images: Map<string, string>;
  knownKeys: Set<string>;
  usesMultirow: boolean;
  usesCitations: boolean;
  printedBibliography: boolean;
  warnings: Set<string>;
}

function textOf(node: DocNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(textOf).join('');
}

function walk(node: DocNode, visit: (n: DocNode) => void) {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

/** Every image `src` in document order, for the caller to fetch. */
export function collectImageSources(doc: DocNode): string[] {
  const sources: string[] = [];
  walk(doc, (n) => {
    const src = n.type === 'image' ? n.attrs?.src : undefined;
    if (typeof src === 'string' && src && !sources.includes(src)) sources.push(src);
  });
  return sources;
}

function applyMarks(text: string, marks: DocNode['marks'] = []): string {
  let out = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        out = `\\textbf{${out}}`;
        break;
      case 'italic':
        out = `\\textit{${out}}`;
        break;
      case 'underline':
        out = `\\uline{${out}}`;
        break;
      case 'strike':
        out = `\\sout{${out}}`;
        break;
      case 'code':
        out = `\\texttt{${out}}`;
        break;
      case 'link': {
        const href = mark.attrs?.href;
        if (typeof href === 'string' && href) out = `\\href{${escapeUrl(href)}}{${out}}`;
        break;
      }
    }
  }
  return out;
}

function inline(nodes: DocNode[] | undefined, ctx: Context): string {
  return (nodes ?? []).map((n) => inlineNode(n, ctx)).join('');
}

function inlineNode(node: DocNode, ctx: Context): string {
  switch (node.type) {
    case 'text':
      return applyMarks(escapeLatex(node.text ?? ''), node.marks);
    case 'hardBreak':
      return '\\newline{}';
    case 'citation': {
      const key = String(node.attrs?.citationKey ?? '');
      if (!key) return '';
      ctx.usesCitations = true;
      if (!ctx.knownKeys.has(key)) {
        ctx.warnings.add(`Citation "${key}" has no matching reference and will print as "?".`);
      }
      const locator = String(node.attrs?.locator ?? '');
      const command = node.attrs?.narrative ? ctx.bib.narrative : '\\cite';
      return `${command}${locator ? `[${escapeLatex(locator)}]` : ''}{${key}}`;
    }
    case 'crossReference': {
      const id = String(node.attrs?.floatId ?? '');
      const kind = ctx.floats.get(id);
      if (!kind) {
        ctx.warnings.add('A cross-reference points at a figure or table that no longer exists.');
        return '??';
      }
      const prefix = kind === 'figure' ? ctx.figurePrefix : 'Table';
      return `${prefix}~\\ref{${labelFor(kind, id)}}`;
    }
    case 'image':
      // Images only appear inside figures; a stray inline one is skipped.
      return '';
    default:
      return inline(node.content, ctx);
  }
}

function paragraphs(nodes: DocNode[] | undefined, ctx: Context): string {
  return (nodes ?? [])
    .map((n) => block(n, ctx))
    .filter(Boolean)
    .join('\n\n');
}

function block(node: DocNode, ctx: Context): string {
  switch (node.type) {
    case 'paragraph':
      return inline(node.content, ctx).trim();

    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 5);
      const star = node.attrs?.unnumbered ? '*' : '';
      return `\\${HEADING_COMMANDS[level - 1]}${star}{${inline(node.content, ctx)}}`;
    }

    case 'bulletList':
    case 'orderedList': {
      const env = node.type === 'bulletList' ? 'itemize' : 'enumerate';
      const items = (node.content ?? [])
        .map((item) => `  \\item ${paragraphs(item.content, ctx).replace(/\n\n/g, '\n\n  ')}`)
        .join('\n');
      return `\\begin{${env}}\n${items}\n\\end{${env}}`;
    }

    case 'blockquote':
      return `\\begin{quote}\n${paragraphs(node.content, ctx)}\n\\end{quote}`;

    case 'codeBlock': {
      // verbatim takes text as-is; only its own end marker would break it.
      const code = textOf(node).replace(/\\end\{verbatim\}/g, '\\end {verbatim}');
      return `\\begin{verbatim}\n${code}\n\\end{verbatim}`;
    }

    case 'horizontalRule':
      return '\\noindent\\rule{\\linewidth}{0.4pt}';

    case 'pageBreak':
      return '\\newpage';

    case 'figure':
      return figure(node, ctx);

    case 'tableFigure':
      return tableFigure(node, ctx);

    case 'table':
      return tabular(node, ctx);

    case 'bibliography':
      ctx.printedBibliography = true;
      return ctx.bib.print();

    case 'runningHead':
      // A print header, not body text. apa7's \shorttitle is set in the preamble.
      return '';

    default:
      return paragraphs(node.content, ctx);
  }
}

function floatParts(node: DocNode, ctx: Context) {
  const children = node.content ?? [];
  const caption = children.find((c) => c.type === 'floatCaption');
  const note = children.find((c) => c.type === 'floatNote');
  return {
    caption: caption ? inline(caption.content, ctx).trim() : '',
    note: note ? inline(note.content, ctx).trim() : '',
    wide: node.attrs?.span === 'page',
    id: String(node.attrs?.floatId ?? ''),
  };
}

function figure(node: DocNode, ctx: Context): string {
  const { caption, note, wide, id } = floatParts(node, ctx);
  const env = wide ? 'figure*' : 'figure';
  const image = node.content?.find((c) => c.type === 'image');
  const src = typeof image?.attrs?.src === 'string' ? image.attrs.src : '';
  const path = ctx.images.get(src);

  let graphic: string;
  if (path) {
    graphic = `\\includegraphics[width=\\linewidth]{${path}}`;
  } else {
    ctx.warnings.add('An image could not be downloaded; its figure shows a placeholder box.');
    graphic = '\\fbox{\\parbox{0.8\\linewidth}{\\centering Image not exported}}';
  }

  return [
    `\\begin{${env}}[htbp]`,
    '  \\centering',
    `  ${graphic}`,
    caption ? `  \\caption{${caption}}` : '',
    id ? `  \\label{${labelFor('figure', id)}}` : '',
    note ? `  \\par\\footnotesize ${note}` : '',
    `\\end{${env}}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function tableFigure(node: DocNode, ctx: Context): string {
  const { caption, note, wide, id } = floatParts(node, ctx);
  const env = wide ? 'table*' : 'table';
  const table = node.content?.find((c) => c.type === 'table');

  return [
    `\\begin{${env}}[htbp]`,
    '  \\centering',
    caption ? `  \\caption{${caption}}` : '',
    id ? `  \\label{${labelFor('table', id)}}` : '',
    table ? tabular(table, ctx) : '',
    note ? `  \\par\\footnotesize ${note}` : '',
    `\\end{${env}}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A ProseMirror table as `tabular` with booktabs rules.
 *
 * ProseMirror leaves out the positions a row-spanning cell covers in the rows
 * below it, while `tabular` needs every column written in every row, so the
 * covered positions are tracked and filled with empty cells.
 */
function tabular(node: DocNode, ctx: Context): string {
  const rows = node.content ?? [];
  const span = (cell: DocNode, key: 'colspan' | 'rowspan') =>
    Math.max(1, Number(cell.attrs?.[key] ?? 1) || 1);

  const columnCount = Math.max(
    1,
    ...rows.map((row) => (row.content ?? []).reduce((sum, cell) => sum + span(cell, 'colspan'), 0))
  );

  /** Column index to rows still covered by a cell above, and that cell's width. */
  const covered = new Map<number, { rows: number; width: number }>();
  const lines: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = [...(row.content ?? [])];
    const out: string[] = [];
    let column = 0;

    while (column < columnCount) {
      const cover = covered.get(column);
      if (cover && cover.rows > 0) {
        out.push(cover.width > 1 ? `\\multicolumn{${cover.width}}{l}{}` : '');
        cover.rows -= 1;
        column += cover.width;
        continue;
      }

      const cell = cells.shift();
      if (!cell) {
        out.push('');
        column += 1;
        continue;
      }

      const colspan = span(cell, 'colspan');
      const rowspan = span(cell, 'rowspan');
      let text = (cell.content ?? [])
        .map((p) => inline(p.content, ctx).trim())
        .filter(Boolean)
        .join(' ');
      if (cell.type === 'tableHeader') text = `\\textbf{${text}}`;
      if (rowspan > 1) {
        ctx.usesMultirow = true;
        text = `\\multirow{${rowspan}}{*}{${text}}`;
        covered.set(column, { rows: rowspan - 1, width: colspan });
      }
      out.push(colspan > 1 ? `\\multicolumn{${colspan}}{l}{${text}}` : text);
      column += colspan;
    }

    lines.push(`    ${out.join(' & ')} \\\\`);
    const isHeader = (row.content ?? []).every((c) => c.type === 'tableHeader');
    const nextIsHeader = (rows[rowIndex + 1]?.content ?? []).every((c) => c.type === 'tableHeader');
    if (isHeader && rows[rowIndex + 1] && !nextIsHeader) lines.push('    \\midrule');
  });

  return [
    `  \\begin{tabular}{${'l'.repeat(columnCount)}}`,
    '    \\toprule',
    ...lines,
    '    \\bottomrule',
    '  \\end{tabular}',
  ].join('\n');
}

/* ------------------------------------------------------------------------- */
/* Document assembly                                                         */
/* ------------------------------------------------------------------------- */

interface Sections {
  abstract: DocNode[];
  body: DocNode[];
  runningHead: string;
  /** The heading text of a References section that sits on the bibliography. */
  referencesTitle?: string;
}

/**
 * Splits off the abstract (a heading titled "Abstract", or marked as APA's
 * abstract, and what follows it up to the next heading) and drops a
 * "References" heading placed right above the bibliography, which prints its
 * own.
 */
function splitSections(doc: DocNode): Sections {
  const nodes = doc.content ?? [];
  const result: Sections = { abstract: [], body: [], runningHead: '' };
  let inAbstract = false;

  nodes.forEach((node, i) => {
    if (node.type === 'runningHead') {
      result.runningHead = textOf(node).trim();
      return;
    }
    if (node.type === 'heading') {
      const title = textOf(node);
      if (node.attrs?.apaRole === 'abstract' || ABSTRACT_TITLE.test(title)) {
        inAbstract = true;
        return;
      }
      inAbstract = false;
      if (nodes[i + 1]?.type === 'bibliography' && REFERENCES_TITLE.test(title)) {
        result.referencesTitle = title.trim();
        return;
      }
    }
    (inAbstract ? result.abstract : result.body).push(node);
  });

  return result;
}

function engineRc(engine: LatexTemplate['engine']): string {
  const mode = { pdflatex: 1, lualatex: 4, xelatex: 5 }[engine];
  return `# Tells latexmk (and Overleaf) which engine this paper is built with.\n$pdf_mode = ${mode};\n`;
}

/** Converts a document to the files of a LaTeX project. */
export function toLatex(input: LatexExportInput): LatexExport {
  const template = input.template ?? DEFAULT_TEMPLATE;
  const cls = template.documentClass;
  const bib = bibSetup(template, input.citationStyle);

  const floats = new Map<string, 'figure' | 'table'>();
  walk(input.doc, (n) => {
    const id = n.attrs?.floatId;
    if (typeof id === 'string' && id && (n.type === 'figure' || n.type === 'tableFigure')) {
      floats.set(id, n.type === 'figure' ? 'figure' : 'table');
    }
  });

  const ctx: Context = {
    bib,
    figurePrefix: input.citationStyle === 'ieee' || cls === 'IEEEtran' ? 'Fig.' : 'Figure',
    floats,
    images: input.images ?? new Map(),
    knownKeys: new Set(input.references.map((r) => r.citationKey)),
    usesMultirow: false,
    usesCitations: false,
    printedBibliography: false,
    warnings: new Set(),
  };

  // The bibliography's title is known before the body is converted, so
  // `print` can carry it when the bibliography node is reached.
  const sections = splitSections(input.doc);
  if (sections.referencesTitle && bib.tool === 'biber') {
    const title = sections.referencesTitle;
    ctx.bib = { ...bib, print: () => bib.print(title) };
  }

  const abstract = paragraphs(sections.abstract, ctx);
  let body = paragraphs(sections.body, ctx);

  const hasReferences = input.references.length > 0;
  if (ctx.usesCitations && !ctx.printedBibliography) {
    body += `\n\n${ctx.bib.print()}`;
  }
  const needsBib = ctx.usesCitations || ctx.printedBibliography;

  ctx.warnings.add('Author names are not exported. Fill in \\author{} in main.tex.');
  if (cls === 'beamer') {
    ctx.warnings.add(
      'Slides are exported as plain sections. Split them into \\begin{frame} blocks before compiling.'
    );
  }

  /* Preamble */
  const options = template.classOptions.length ? `[${template.classOptions.join(',')}]` : '';
  const title = escapeLatex(input.title.trim() || 'Untitled Document');
  // `false` marks a line this document does not need; '' is a deliberate gap.
  const preamble = [
    `% Exported from Colres. Build with ${template.engine}${needsBib ? ` and ${bib.tool}` : ''}.`,
    `\\documentclass${options}{${cls}}`,
    '',
    template.engine === 'pdflatex' ? '\\usepackage[T1]{fontenc}' : '\\usepackage{fontspec}',
    '\\usepackage{graphicx}',
    '\\usepackage{booktabs}',
    ctx.usesMultirow && '\\usepackage{multirow}',
    '\\usepackage[normalem]{ulem}',
    !HYPERREF_CLASSES.has(cls) && '\\usepackage{hyperref}',
    ...(needsBib ? bib.preamble : []),
    '',
    `\\title{${title}}`,
    cls === 'apa7' && `\\shorttitle{${escapeLatex(sections.runningHead || input.title.trim())}}`,
    '\\author{}',
    cls === 'apa7' && abstract !== '' && `\\abstract{${abstract}}`,
  ].filter((line): line is string => line !== false);

  /* Front matter: where the abstract goes differs by class. */
  const abstractEnv = abstract ? `\\begin{abstract}\n${abstract}\n\\end{abstract}` : '';
  let front: string;
  if (cls === 'elsarticle') {
    front = ['\\begin{frontmatter}', abstractEnv, '\\end{frontmatter}'].filter(Boolean).join('\n');
  } else if (cls === 'acmart') {
    front = [abstractEnv, '\\maketitle'].filter(Boolean).join('\n\n');
  } else if (cls === 'apa7') {
    front = '\\maketitle';
  } else {
    front = ['\\maketitle', abstractEnv].filter(Boolean).join('\n\n');
  }

  const tex = [
    ...preamble,
    '',
    '\\begin{document}',
    '',
    front,
    '',
    body,
    '',
    '\\end{document}',
    '',
  ].join('\n');

  const files: Record<string, string> = {
    'main.tex': tex,
    latexmkrc: engineRc(template.engine),
  };
  if (needsBib || hasReferences) files['references.bib'] = toBibtexFile(input.references);

  return { files, warnings: [...ctx.warnings] };
}
