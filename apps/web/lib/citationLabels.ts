/**
 * One entry point for in-text citation labels, whatever the style.
 *
 * Styles point from the text to the list in one of three ways — by number
 * (IEEE, Vancouver), by author and year (APA, Harvard), or by author and page
 * (MLA) — and each has its own module. The editor and the printed paper both
 * call this, so switching a document's style changes every citation in both
 * the same way.
 */

import { labelAuthorDateCitations } from './authorDate.ts';
import { labelAuthorPageCitations } from './authorPage.ts';
import { type CitationStyle, citationSystem, type DisplayReference } from './citationFormat.ts';
import {
  type CitationNumbering,
  type CitationOccurrence,
  numberCitations,
} from './citationNumbering.ts';

export function labelCitations(
  occurrences: readonly CitationOccurrence[],
  references: readonly DisplayReference[],
  style: CitationStyle
): CitationNumbering {
  switch (citationSystem(style)) {
    case 'author-page':
      return labelAuthorPageCitations(occurrences, references);
    case 'author-date':
      return labelAuthorDateCitations(occurrences, references, style);
    default:
      return numberCitations(
        occurrences,
        new Set(references.map((reference) => reference.citationKey)),
        style
      );
  }
}
