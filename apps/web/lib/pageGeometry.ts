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
 * Sizes are derived from the document's `templateSnapshot.classOptions` — the
 * same `a4paper` / `letterpaper` and `11pt` / `12pt` values the create wizard
 * already collects — so a document laid out for A4 is never previewed as US
 * Letter.
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

export interface PageGeometry {
  id: 'a4' | 'letter';
  label: string;
  /** Value for the `size` descriptor of the print `@page` rule. */
  cssPageSize: 'A4' | 'Letter';
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
  /** Margin expressed in inches, for the print `@page` rule. */
  marginIn: number;
  bodyFontPx: number;
  /** Writable width inside the margins. */
  contentWidthPx: number;
  /** Writable height inside the margins — what pagination measures against. */
  contentHeightPx: number;
}

const PAGE_SIZES = {
  a4: { label: 'A4', cssPageSize: 'A4' as const, widthIn: 210 / 25.4, heightIn: 297 / 25.4 },
  letter: { label: 'US Letter', cssPageSize: 'Letter' as const, widthIn: 8.5, heightIn: 11 },
};

/**
 * A one inch margin on every side. LaTeX classes vary, but the document is
 * rich text here and only compiled later, so a conventional margin is a more
 * honest preview than pretending to reproduce a specific class's geometry.
 */
const DEFAULT_MARGIN_IN = 1;

const DEFAULT_BODY_PT = 11;

export const DEFAULT_PAGE_GEOMETRY = buildGeometry('a4', DEFAULT_BODY_PT);

function buildGeometry(id: 'a4' | 'letter', bodyPt: number): PageGeometry {
  const size = PAGE_SIZES[id];
  const pageWidthPx = Math.round(size.widthIn * PX_PER_INCH);
  const pageHeightPx = Math.round(size.heightIn * PX_PER_INCH);
  const marginPx = Math.round(DEFAULT_MARGIN_IN * PX_PER_INCH);

  return {
    id,
    label: size.label,
    cssPageSize: size.cssPageSize,
    pageWidthPx,
    pageHeightPx,
    marginPx,
    marginIn: DEFAULT_MARGIN_IN,
    bodyFontPx: Math.round(bodyPt * PX_PER_PT * 100) / 100,
    contentWidthPx: pageWidthPx - marginPx * 2,
    contentHeightPx: pageHeightPx - marginPx * 2,
  };
}

/**
 * Resolves page geometry from a document's template snapshot class options.
 *
 * Unknown or absent options fall back to A4 at 11pt rather than throwing: a
 * document created before templates existed still has to open in paged view.
 */
export function getPageGeometry(classOptions?: readonly string[] | null): PageGeometry {
  if (!classOptions || classOptions.length === 0) {
    return DEFAULT_PAGE_GEOMETRY;
  }

  const options = classOptions.map((option) => option.toLowerCase());

  const id: 'a4' | 'letter' = options.includes('letterpaper') ? 'letter' : 'a4';

  const bodyPt = options.includes('12pt') ? 12 : options.includes('10pt') ? 10 : DEFAULT_BODY_PT;

  return buildGeometry(id, bodyPt);
}
