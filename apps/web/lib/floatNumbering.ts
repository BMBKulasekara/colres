/**
 * Numbering for figures and tables — IEEE's "floats".
 *
 * Numbers are a property of the document, not of the float: inserting a figure
 * near the top renumbers every figure below it and every mention of them in
 * the text. That makes this the single source of truth for three surfaces that
 * must agree — the caption drawn in the editor, the cross-reference in the
 * prose, and the printed paper — exactly as `citationNumbering` is for
 * references.
 *
 * The two sequences are independent and continuous: figures count 1, 2, 3 in
 * Arabic across the whole paper, tables count I, II, III in Roman across the
 * whole paper, and neither restarts at a section or an appendix.
 *
 * Kept free of ProseMirror and the DOM so the rules can be exercised in Node.
 */

export type FloatKind = 'figure' | 'table';

/** One float as it appears in the document, in document order. */
export interface FloatOccurrence {
  /** Stable identity, stored on the node. Unlike the number, it never moves. */
  id: string;
  kind: FloatKind;
}

export interface FloatLabels {
  /** Float id to its number within its own sequence. 1-based. */
  numbers: Map<string, number>;
  /** Float id to its caption prefix: "Fig. 1." or "TABLE I". */
  captionLabels: Map<string, string>;
  /** Float id to how the prose refers to it: "Fig. 1" or "Table I". */
  referenceLabels: Map<string, string>;
  /** Ids in document order, per sequence. */
  order: string[];
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Upper-case Roman numerals, which is how IEEE numbers its tables. */
export function toRoman(value: number): string {
  if (!Number.isFinite(value) || value < 1) return '';

  let remaining = Math.floor(value);
  let out = '';
  for (const [amount, numeral] of ROMAN) {
    while (remaining >= amount) {
      out += numeral;
      remaining -= amount;
    }
  }
  return out;
}

/**
 * The em space IEEE sets between a caption label and the caption text.
 *
 * A real U+2003 rather than a wide margin, because the caption is one run of
 * text that has to survive being copied out of the editor, printed, and later
 * written into a LaTeX source — none of which carry CSS with them.
 */
export const EM_SPACE = ' ';

/**
 * Which convention labels the floats.
 *
 * `ieee` is the default, used by every format that does not ask otherwise.
 * `apa` writes "Figure 1" and "Table 1" — both spelled out, both in Arabic —
 * in the caption and in the prose alike; the label sits in bold on its own
 * line above the italic title.
 */
export type FloatScheme = 'ieee' | 'apa';

/**
 * What a caption starts with.
 *
 * IEEE: a figure is abbreviated and takes a period after the number; a table
 * is spelled out in capitals and takes none, because the label sits on its own
 * line above the title rather than running into it.
 */
export function captionLabel(
  kind: FloatKind,
  number: number,
  scheme: FloatScheme = 'ieee'
): string {
  if (scheme === 'apa') return referenceLabel(kind, number, scheme);
  return kind === 'figure' ? `Fig. ${number}.` : `TABLE ${toRoman(number)}`;
}

/**
 * What the prose calls it.
 *
 * "Fig. 1" keeps the abbreviation IEEE uses everywhere, including at the start
 * of a sentence. "Table I" is title case rather than the caption's all-caps,
 * because the all-caps form belongs to the caption block alone.
 */
export function referenceLabel(
  kind: FloatKind,
  number: number,
  scheme: FloatScheme = 'ieee'
): string {
  if (scheme === 'apa') return kind === 'figure' ? `Figure ${number}` : `Table ${number}`;
  return kind === 'figure' ? `Fig. ${number}` : `Table ${toRoman(number)}`;
}

/**
 * Assigns numbers to every float in the document.
 *
 * The two sequences advance independently, so a paper whose floats interleave
 * still reads Fig. 1, TABLE I, Fig. 2, TABLE II.
 */
export function numberFloats(
  occurrences: readonly FloatOccurrence[],
  scheme: FloatScheme = 'ieee'
): FloatLabels {
  const numbers = new Map<string, number>();
  const captionLabels = new Map<string, string>();
  const referenceLabels = new Map<string, string>();
  const order: string[] = [];

  const counts: Record<FloatKind, number> = { figure: 0, table: 0 };

  for (const occurrence of occurrences) {
    // A duplicated id would otherwise consume a number and leave two floats
    // claiming it. It can happen: copying a figure copies its attributes.
    if (numbers.has(occurrence.id) || !occurrence.id) continue;

    counts[occurrence.kind] += 1;
    const number = counts[occurrence.kind];

    numbers.set(occurrence.id, number);
    captionLabels.set(occurrence.id, captionLabel(occurrence.kind, number, scheme));
    referenceLabels.set(occurrence.id, referenceLabel(occurrence.kind, number, scheme));
    order.push(occurrence.id);
  }

  return { numbers, captionLabels, referenceLabels, order };
}

/**
 * Words a title-case rule leaves lowercase unless they open the title.
 *
 * IEEE asks for "significant words" capitalised in a table title, which in
 * practice means everything but short articles, conjunctions and prepositions.
 */
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'via',
  'vs',
  'with',
]);

/**
 * Capitalises the significant words of a table title.
 *
 * A word already containing an inner capital is left exactly as typed — an
 * acronym or a name like "mAP", "ResNet" or "GPUs" means what its author
 * wrote, and lowercasing it to re-capitalise the first letter would destroy
 * information this function has no way to recover.
 */
export function toTitleCase(title: string): string {
  const words = title.split(/(\s+)/);
  let significantSeen = false;

  return words
    .map((word) => {
      if (/^\s*$/.test(word)) return word;

      const bare = word.replace(/[^A-Za-z]/g, '');
      const isMinor = MINOR_WORDS.has(bare.toLowerCase());
      const isFirst = !significantSeen;
      significantSeen = true;

      // Preserve anything with an internal capital: acronyms and camel-cased
      // names are already correct and are not ours to normalise.
      if (/[A-Z]/.test(word.slice(1))) return word;

      if (isMinor && !isFirst) return word.toLowerCase();

      return word.replace(/[A-Za-z]/, (letter) => letter.toUpperCase());
    })
    .join('');
}

/**
 * Floats the text never refers to.
 *
 * IEEE requires every figure and table to be cited in the prose, so an uncited
 * float is a defect in the paper rather than a stylistic choice — and it is
 * invisible to the author, which is why it is worth surfacing.
 */
export function uncitedFloats(
  occurrences: readonly FloatOccurrence[],
  referencedIds: ReadonlySet<string>
): FloatOccurrence[] {
  return occurrences.filter((occurrence) => !referencedIds.has(occurrence.id));
}
