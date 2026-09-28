/**
 * The reference list, as HTML.
 *
 * Shared by the References section in the editor and by the printed paper, so
 * that what an author arranges on screen is what comes out of the printer. The
 * two surfaces cannot share a React component — one of them renders into an
 * iframe with none of the app's runtime — but they can share this, and a
 * string of HTML is the largest thing they have in common.
 *
 * Numbered styles render a list of two-column rows. That grid *is* the hanging
 * indent IEEE asks for: the bracketed number sits flush in the left margin and
 * the entry wraps against its own left edge rather than tucking under the
 * bracket. Author–date styles have no number to hang, so their rows are plain
 * paragraphs with the 0.5 in. hanging indent APA specifies
 * (`bib-item--hanging`). The stylesheets that go with it live in `globals.css`
 * (editor) and `printDocument.ts` (paper), and use these same class names.
 */

import { yearSuffixes } from './authorDate';
import {
  type CitationStyle,
  type DisplayReference,
  formatReference,
  isAuthorDateStyle,
  isNumberedStyle,
} from './citationFormat';
import { orderBibliography } from './citationNumbering';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** What the list says where the document cites a reference it does not hold. */
export const UNCITED_NOTE = '(not cited in the text)';

/**
 * Renders the whole list, or an empty string when there is nothing to render.
 *
 * Numbered styles order entries by first citation, as IEEE numbers them. A
 * reference the text never cites cannot be numbered — a number is a claim that
 * a citation points at it — so those are listed afterwards and marked instead.
 * Author–date styles order alphabetically and mark uncited entries in place.
 */
export function renderBibliographyHtml(
  references: readonly DisplayReference[],
  citationOrder: readonly string[],
  style: CitationStyle
): string {
  if (references.length === 0) return '';

  const numbered = isNumberedStyle(style);
  const authorDate = isAuthorDateStyle(style);
  const suffixes = authorDate ? yearSuffixes(references) : undefined;

  const items = orderBibliography(references, citationOrder, style).map(
    ({ reference, number, cited }) => {
      const body = formatReference(reference, style, {
        yearSuffix: suffixes?.get(reference.citationKey),
      })
        .map((segment) =>
          segment.italic ? `<i>${escapeHtml(segment.text)}</i>` : escapeHtml(segment.text)
        )
        .join('');

      const uncited = cited ? '' : `<span class="bib-uncited">${UNCITED_NOTE}</span> `;

      if (authorDate) {
        return `<li class="bib-item bib-item--hanging"><span class="bib-text">${uncited}${body}</span></li>`;
      }

      const marker = number !== undefined && numbered ? `[${number}]` : '';

      return (
        `<li class="bib-item">` +
        `<span class="bib-marker">${marker}</span>` +
        `<span class="bib-text">${uncited}${body}</span>` +
        '</li>'
      );
    }
  );

  return `<ul class="bib-list">${items.join('')}</ul>`;
}
