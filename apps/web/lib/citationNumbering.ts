/**
 * IEEE in-text citation numbering.
 *
 * Numbers are a property of the *document*, not of the bibliography: IEEE
 * numbers references in the order they are first cited, so [1] is whatever the
 * author mentioned first. That makes this the single source of truth for three
 * surfaces that must agree — the marker drawn in the editor, the order of the
 * reference list, and the printed paper.
 *
 * Kept free of ProseMirror and the DOM so the rules that are easy to get subtly
 * wrong — first-appearance ordering, run grouping, range collapsing — can be
 * exercised directly in Node.
 *
 * Author–date styles (APA) label citations in `authorDate.ts` instead, and
 * return the same `CitationNumbering` shape.
 */

import { sortAuthorDate } from './authorDate.ts';
import { type CitationStyle, type DisplayReference, isAuthorDateStyle } from './citationFormat.ts';

/** One citation as it appears in the document, in document order. */
export interface CitationOccurrence {
  citationKey: string;
  /**
   * A page, section or equation reference for this particular mention, e.g.
   * "p. 13". IEEE puts it inside the brackets: [1, p. 13].
   */
  locator?: string;
  /**
   * True when this citation sits directly against the one before it, with no
   * intervening text. Adjacent citations are set as a single bracket group.
   */
  adjacentToPrevious: boolean;
  /**
   * The author is named as part of the sentence — "Smith (2020) found" —
   * rather than in parentheses. Author–date styles only; numbered styles
   * print the same bracket either way.
   */
  narrative?: boolean;
}

export interface CitationLabel {
  /** What to draw, e.g. "[1]", "[1], [3]", "[1]-[3]", "[1, p. 13]". */
  text: string;
  /**
   * True for the second and later citations of a group: the leader carries the
   * whole group's label, so the rest render nothing.
   */
  hidden: boolean;
  /** No reference in the bibliography has this key. */
  unresolved: boolean;
}

export interface CitationNumbering {
  /** Citation key to its IEEE number, by first appearance. 1-based. */
  numbers: Map<string, number>;
  /** Keys in first-appearance order — the order the reference list must use. */
  order: string[];
  /** One label per occurrence, positionally aligned with the input. */
  labels: CitationLabel[];
}

/** The en dash IEEE sets between the ends of a citation range. */
const RANGE_DASH = '–';

/**
 * A run of three or more consecutive numbers is written as a range. Two in a
 * row stay separate, because "[1], [2]" is no longer than "[1]-[2]" and IEEE
 * only collapses where it actually saves space.
 */
const MIN_RANGE_LENGTH = 3;

/**
 * Formats one bracket group from the numbers it contains.
 *
 * Consecutive stretches collapse to a range and everything else is listed,
 * so 1,2,3,7 becomes "[1]-[3], [7]".
 */
function formatGroup(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (sorted.length === 0) return '';

  const parts: string[] = [];
  let runStart = 0;

  for (let i = 1; i <= sorted.length; i++) {
    const isEnd = i === sorted.length || (sorted[i] as number) !== (sorted[i - 1] as number) + 1;
    if (!isEnd) continue;

    const runLength = i - runStart;
    if (runLength >= MIN_RANGE_LENGTH) {
      parts.push(`[${sorted[runStart]}]${RANGE_DASH}[${sorted[i - 1]}]`);
    } else {
      for (let j = runStart; j < i; j++) parts.push(`[${sorted[j]}]`);
    }
    runStart = i;
  }

  return parts.join(', ');
}

/**
 * Assigns numbers and builds a label for every citation in the document.
 *
 * `knownKeys` is the set of keys the bibliography actually holds. A citation of
 * a key that is not there gets no number — numbering it would silently shift
 * every later reference — and is reported as unresolved instead.
 */
export function numberCitations(
  occurrences: readonly CitationOccurrence[],
  knownKeys: ReadonlySet<string>
): CitationNumbering {
  const numbers = new Map<string, number>();
  const order: string[] = [];

  for (const occurrence of occurrences) {
    if (!knownKeys.has(occurrence.citationKey)) continue;
    if (numbers.has(occurrence.citationKey)) continue;
    order.push(occurrence.citationKey);
    numbers.set(occurrence.citationKey, order.length);
  }

  const labels: CitationLabel[] = occurrences.map(() => ({
    text: '',
    hidden: false,
    unresolved: false,
  }));

  // Walk the occurrences in runs of adjacent citations. A citation carrying a
  // locator is always its own group: "[1, p. 13], [2]" is the only way to say
  // that the page number belongs to the first source and not to both.
  let index = 0;
  while (index < occurrences.length) {
    let end = index + 1;
    if (!occurrences[index]?.locator) {
      while (
        end < occurrences.length &&
        occurrences[end]?.adjacentToPrevious === true &&
        !occurrences[end]?.locator
      ) {
        end += 1;
      }
    }

    const group = occurrences.slice(index, end);
    const resolved = group.filter((o) => numbers.has(o.citationKey));
    const leader = labels[index] as CitationLabel;

    if (resolved.length === 0) {
      // Nothing in this group is in the bibliography. Show a marker the author
      // can see and act on rather than an empty gap.
      leader.text = '[?]';
      leader.unresolved = true;
    } else {
      const first = group[0];
      if (group.length === 1 && first?.locator) {
        leader.text = `[${numbers.get(first.citationKey)}, ${first.locator}]`;
      } else {
        leader.text = formatGroup(resolved.map((o) => numbers.get(o.citationKey) as number));
      }
      leader.unresolved = resolved.length < group.length;
    }

    for (let i = index + 1; i < end; i++) {
      (labels[i] as CitationLabel).hidden = true;
    }

    index = end;
  }

  return { numbers, order, labels };
}

/** One entry of the reference list, as it is to be displayed. */
export interface OrderedReference<T> {
  reference: T;
  /** Only in numbered styles, and only for references the text cites. */
  number?: number;
  /** False for a listed reference the text never cites. */
  cited: boolean;
}

/**
 * Orders the bibliography for display.
 *
 * Numbered styles: cited references first, in the order the text cites them,
 * then everything else. IEEE expects every listed reference to be cited, so the
 * uncited tail is a problem to surface rather than a section to number. They
 * keep whatever order the caller supplied and are returned without a number.
 *
 * Author–date styles: the whole list alphabetically, as APA sets it. Nothing is
 * numbered; an uncited entry stays in its alphabetical place and is flagged,
 * since APA equally expects every entry to be cited.
 */
export function orderBibliography<T extends DisplayReference>(
  references: readonly T[],
  order: readonly string[],
  style?: CitationStyle
): OrderedReference<T>[] {
  const citedKeys = new Set(order);

  if (style && isAuthorDateStyle(style)) {
    return sortAuthorDate(references).map((reference) => ({
      reference,
      cited: citedKeys.has(reference.citationKey),
    }));
  }

  const byKey = new Map(references.map((reference) => [reference.citationKey, reference]));
  const cited: OrderedReference<T>[] = [];

  order.forEach((key) => {
    const reference = byKey.get(key);
    if (reference) cited.push({ reference, number: cited.length + 1, cited: true });
  });

  const uncited = references
    .filter((reference) => !citedKeys.has(reference.citationKey))
    .map((reference) => ({ reference, cited: false }));

  return [...cited, ...uncited];
}
