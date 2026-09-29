/**
 * Physical page geometry, in CSS pixels.
 *
 * This is the single source of truth shared by the on-screen paged view and
 * the print stylesheet. They have to agree: the editor draws page boundaries
 * by measuring against these numbers, and the browser paginates the printout
 * against the same ones. If the two drift apart, the breaks a user sees while
 * writing stop predicting the breaks they get on paper, which is the whole
 * point of the feature.
 *
 * Sizes are derived from the document's `templateSnapshot` — the
 * `documentClass` plus the same `a4paper` / `letterpaper` and `11pt` / `12pt`
 * class options the create wizard already collects — so a document laid out
 * for A4 is never previewed as US Letter, and an IEEE paper is previewed in
 * the two-column measure its class will actually set.
 */

/** CSS reference pixels per inch. Fixed by the CSS spec, not by the display. */
const PX_PER_INCH = 96;

/**
 * The gutter drawn between two pages on screen. Shared by the canvas gradient
 * and the pagination measurement, which must use the same period or the
 * painted page edges drift away from the text.
 */
export const PAGE_GAP_PX = 24;

/** CSS pixels per typographic point (72pt = 1in). */
const PX_PER_PT = PX_PER_INCH / 72;

/** Margins differ per side once a publisher class is involved. */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Which typographic ruleset the document is drawn with. Not the same thing as
 * the column count: a single-column IEEE peer-review manuscript still wants
 * IEEE's Roman section numbering and Times measure.
 */
export type DocumentStyleId = 'default' | 'ieee' | 'apa' | 'mla';

export interface PageGeometry {
  id: 'a4' | 'letter';
  label: string;
  /** Value for the `size` descriptor of the print `@page` rule. */
  cssPageSize: 'A4' | 'Letter';
  pageWidthPx: number;
  pageHeightPx: number;
  margin: PageMargins;
  /** Margins expressed in inches, for the print `@page` rule. */
  marginIn: PageMargins;
  bodyFontPx: number;
  /** Writable width inside the margins. */
  contentWidthPx: number;
  /** Writable height inside the margins — what pagination measures against. */
  contentHeightPx: number;
  /** Text columns per page. Two for the IEEE conference and journal formats. */
  columns: 1 | 2;
  /** Gutter between columns; zero when there is only one. */
  columnGapPx: number;
  /** Width of a single column. Equals `contentWidthPx` in one-column layouts. */
  columnWidthPx: number;
  styleId: DocumentStyleId;
  /** True when every page carries its number in the top-right of the header. */
  pageNumbers: boolean;
}

const PAGE_SIZES = {
  a4: { label: 'A4', cssPageSize: 'A4' as const, widthIn: 210 / 25.4, heightIn: 297 / 25.4 },
  letter: { label: 'US Letter', cssPageSize: 'Letter' as const, widthIn: 8.5, heightIn: 11 },
};

/**
 * A page recipe, before it is resolved against a paper size.
 *
 * Margins are in inches because that is the unit every publisher states them
 * in, and because the print `@page` rule takes them unchanged.
 */
interface LayoutPreset {
  styleId: DocumentStyleId;
  margins: { a4: PageMargins; letter: PageMargins };
  columnGapIn: number;
  /** Body size the class sets. IEEE is 10pt regardless of the class options. */
  bodyPt?: number;
  /** Body size when the class options name none. */
  defaultBodyPt?: number;
  /** Draws the page number in the top-right corner of every page. */
  pageNumbers?: boolean;
}

/**
 * The generic preset: a one inch margin on every side. LaTeX classes vary, but
 * a venue-neutral document is rich text here and only compiled later, so a
 * conventional margin is a more honest preview than pretending to reproduce a
 * specific class's geometry.
 */
const DEFAULT_PRESET: LayoutPreset = {
  styleId: 'default',
  margins: {
    a4: { top: 1, right: 1, bottom: 1, left: 1 },
    letter: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  columnGapIn: 0,
};

/**
 * IEEEtran's page setup, as stated in IEEE's own "Preparation of Papers"
 * instructions. The A4 figures are the ones from the A4 sample paper: 19mm
 * top, 43mm bottom, 14.32mm either side, with a 4.22mm column gutter. US
 * Letter uses IEEE's letter-size margins instead.
 *
 * Column width is not taken from IEEE's stated 88.9mm — that figure and the
 * side margins together overshoot the sheet by about half a millimetre, an
 * artefact of rounding each number independently. The columns are derived from
 * the writable width instead, so the two of them plus the gutter always add up
 * to exactly the measure.
 */
const IEEE_PRESET: LayoutPreset = {
  styleId: 'ieee',
  margins: {
    a4: { top: 0.75, right: 0.5638, bottom: 1.6929, left: 0.5638 },
    letter: { top: 0.75, right: 0.625, bottom: 1, left: 0.625 },
  },
  columnGapIn: 0.17,
  bodyPt: 10,
};

/**
 * APA 7 student and professional papers: 1 in. margins on every side, one
 * column, and a page number in the top-right corner of every page, the title
 * page included. 12pt Times New Roman is the conventional default; the `11pt`
 * class option covers APA's 11pt alternatives (Calibri, Arial, Georgia).
 */
const APA_PRESET: LayoutPreset = {
  styleId: 'apa',
  margins: {
    a4: { top: 1, right: 1, bottom: 1, left: 1 },
    letter: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  columnGapIn: 0,
  defaultBodyPt: 12,
  pageNumbers: true,
};

/**
 * MLA 9 papers: 1 in. margins on every side, one column, and the author's last
 * name with the page number 0.5 in. from the top, flush right, on every page.
 * 12pt Times New Roman is the conventional choice.
 *
 * MLA has no LaTeX class of its own — its papers are set with `article` — so
 * this preset is chosen by the template's `mla` class option instead.
 */
const MLA_PRESET: LayoutPreset = {
  styleId: 'mla',
  margins: {
    a4: { top: 1, right: 1, bottom: 1, left: 1 },
    letter: { top: 1, right: 1, bottom: 1, left: 1 },
  },
  columnGapIn: 0,
  defaultBodyPt: 12,
  pageNumbers: true,
};

const DEFAULT_BODY_PT = 11;

export const DEFAULT_PAGE_GEOMETRY = buildGeometry('a4', DEFAULT_BODY_PT, DEFAULT_PRESET, 1);

function inchesToPx(margins: PageMargins): PageMargins {
  return {
    top: Math.round(margins.top * PX_PER_INCH),
    right: Math.round(margins.right * PX_PER_INCH),
    bottom: Math.round(margins.bottom * PX_PER_INCH),
    left: Math.round(margins.left * PX_PER_INCH),
  };
}

function buildGeometry(
  id: 'a4' | 'letter',
  bodyPt: number,
  preset: LayoutPreset,
  columns: 1 | 2
): PageGeometry {
  const size = PAGE_SIZES[id];
  const pageWidthPx = Math.round(size.widthIn * PX_PER_INCH);
  const pageHeightPx = Math.round(size.heightIn * PX_PER_INCH);

  const marginIn = preset.margins[id];
  const margin = inchesToPx(marginIn);

  const contentWidthPx = pageWidthPx - margin.left - margin.right;
  const columnGapPx = columns > 1 ? Math.round(preset.columnGapIn * PX_PER_INCH) : 0;
  // Floor rather than round: two columns plus the gutter must never exceed the
  // measure, or the right column would sit in the margin.
  const columnWidthPx =
    columns > 1 ? Math.floor((contentWidthPx - columnGapPx) / columns) : contentWidthPx;

  return {
    id,
    label: size.label,
    cssPageSize: size.cssPageSize,
    pageWidthPx,
    pageHeightPx,
    margin,
    marginIn,
    bodyFontPx: Math.round(bodyPt * PX_PER_PT * 100) / 100,
    contentWidthPx,
    contentHeightPx: pageHeightPx - margin.top - margin.bottom,
    columns,
    columnGapPx,
    columnWidthPx,
    styleId: preset.styleId,
    pageNumbers: preset.pageNumbers ?? false,
  };
}

/**
 * IEEEtran modes that set two columns. `peerreview` is the exception: it is
 * the single-column, wide-margin format reviewers read, so previewing it in
 * two columns would be wrong.
 */
const IEEE_ONE_COLUMN_MODES = new Set(['peerreview', 'peerreviewca', 'draftcls', 'draftclsnofoot']);

function resolvePreset(
  documentClass: string | null | undefined,
  options: readonly string[]
): LayoutPreset {
  if (options.includes('mla')) return MLA_PRESET;
  switch (documentClass?.trim().toLowerCase()) {
    case 'ieeetran':
      return IEEE_PRESET;
    case 'apa7':
      return APA_PRESET;
    default:
      return DEFAULT_PRESET;
  }
}

function resolveColumns(preset: LayoutPreset, options: readonly string[]): 1 | 2 {
  // An explicit class option always wins; it is what the author chose.
  if (options.includes('onecolumn')) return 1;
  if (options.includes('twocolumn')) return 2;

  if (preset.styleId !== 'ieee') return 1;

  return options.some((option) => IEEE_ONE_COLUMN_MODES.has(option)) ? 1 : 2;
}

/**
 * Resolves page geometry from a document's template snapshot.
 *
 * Unknown or absent options fall back to A4 at 11pt in one column rather than
 * throwing: a document created before templates existed still has to open in
 * paged view.
 */
export function getPageGeometry(
  classOptions?: readonly string[] | null,
  documentClass?: string | null
): PageGeometry {
  const options = (classOptions ?? []).map((option) => option.toLowerCase());
  const preset = resolvePreset(documentClass, options);

  const id: 'a4' | 'letter' = options.includes('letterpaper') ? 'letter' : 'a4';

  const bodyPt =
    preset.bodyPt ??
    (options.includes('12pt')
      ? 12
      : options.includes('11pt')
        ? 11
        : options.includes('10pt')
          ? 10
          : (preset.defaultBodyPt ?? DEFAULT_BODY_PT));

  return buildGeometry(id, bodyPt, preset, resolveColumns(preset, options));
}
