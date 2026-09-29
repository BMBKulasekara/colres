import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  type CitationStyle,
  type DisplayReference,
  isAuthorDateStyle,
} from '../../lib/citationFormat';
import { labelCitations } from '../../lib/citationLabels';
import {
  type CitationOccurrence,
  type CitationNumbering as Numbering,
  numberCitations,
} from '../../lib/citationNumbering';

/**
 * Resolves every citation marker in the document to its label: the IEEE
 * number, or for an author–date style such as APA, "(Smith, 2020)".
 *
 * The numbering itself is a pure function of the document plus the set of keys
 * the bibliography holds (`lib/citationNumbering.ts`); this extension is only
 * the part that has to touch ProseMirror — finding the citations, deciding
 * which of them are adjacent, and painting the result.
 *
 * Like pagination, the labels are applied as decorations rather than written
 * into the document. Here the reason is not that the result is client-specific
 * — every client computes the same numbers — but that the number is derived
 * data. Storing it would re-broadcast half the document through Yjs every time
 * a citation is inserted near the top, and would leave stale numbers in any
 * document opened by a client that had not recomputed yet.
 */

export interface CitationNumberingOptions {
  /**
   * Keys present in the bibliography; a citation of anything else is flagged.
   *
   * Read through a function rather than passed by value because the editor is
   * created once and the bibliography keeps changing underneath it — a plain
   * option would freeze the set as it was on the first render, and every
   * reference added afterwards would render as unresolved.
   */
  resolveKnownKeys: () => ReadonlySet<string>;
  /**
   * The document's citation style, which decides between numbering and
   * author–date labels. Read through a function for the same reason as the
   * keys.
   */
  resolveStyle?: () => CitationStyle;
  /**
   * The bibliography itself. Author–date labels are built from each source's
   * authors and year, which the key set alone does not carry.
   */
  resolveReferences?: () => readonly DisplayReference[];
  /** Reports the first-appearance order, which the reference list must match. */
  onOrderChange?: (order: string[]) => void;
}

interface CitationNumberingStorage {
  order: string[];
}

const citationNumberingKey = new PluginKey<DecorationSet>('citationNumbering');

/** Where a citation sits, alongside the data the numbering rules need. */
interface FoundCitation extends CitationOccurrence {
  pos: number;
  size: number;
  /**
   * The separator text between this citation and the one before it, when the
   * two are adjacent. Hidden along with the marker if they end up in one
   * bracket group, since the group's own label already contains the commas.
   */
  gap: { from: number; to: number } | null;
}

/**
 * Collects citations in document order, marking which ones are set against the
 * one before them.
 *
 * "Adjacent" means nothing but optional whitespace and separator punctuation
 * lies between the two markers, so an author who typed `[1][2]` or `[1], [2]`
 * gets one bracket group either way, while `[1] and [2]` stays as two.
 */
function findCitations(doc: PMNode): FoundCitation[] {
  const found: FoundCitation[] = [];
  /** End position of the previous citation, for the adjacency test. */
  let previousEnd: number | null = null;
  /** Text seen since that citation ended. */
  let gap = '';

  doc.descendants((node, pos) => {
    if (node.isText) {
      if (previousEnd !== null) gap += node.text ?? '';
      return true;
    }

    if (node.type.name !== 'citation') {
      // A block boundary separates citations no matter what the text looked
      // like, so a marker at the end of one paragraph never groups with one at
      // the start of the next.
      if (node.isBlock && previousEnd !== null) gap += '\n';
      return true;
    }

    const adjacentToPrevious = previousEnd !== null && /^[\s,;]*$/.test(gap);

    found.push({
      pos,
      size: node.nodeSize,
      citationKey: node.attrs.citationKey ?? '',
      locator: node.attrs.locator || undefined,
      narrative: node.attrs.narrative === true,
      adjacentToPrevious,
      gap: adjacentToPrevious && previousEnd !== null ? { from: previousEnd, to: pos } : null,
    });

    previousEnd = pos + node.nodeSize;
    gap = '';
    return false;
  });

  return found;
}

function buildDecorations(doc: PMNode, options: CitationNumberingOptions) {
  const citations = findCitations(doc);
  const style = options.resolveStyle?.() ?? 'numeric';
  const numbering: Numbering = isAuthorDateStyle(style)
    ? labelCitations(citations, options.resolveReferences?.() ?? [], style)
    : numberCitations(citations, options.resolveKnownKeys(), style);

  const decorations: Decoration[] = [];

  citations.forEach((citation, index) => {
    const label = numbering.labels[index];
    const attrs: Record<string, string> = {};

    if (label?.hidden) {
      // The group leader carries the whole label, so the rest draw nothing.
      attrs['data-citation-hidden'] = 'true';

      // The label already contains the commas, so the separator the author
      // typed is hidden with the marker rather than left doubled up. It is
      // hidden and not deleted: it is their text, and it comes straight back
      // if the citations stop being a group.
      if (citation.gap && citation.gap.to > citation.gap.from) {
        decorations.push(
          Decoration.inline(citation.gap.from, citation.gap.to, {
            class: 'citation-separator',
          })
        );
      }
    } else {
      attrs['data-citation-label'] = label?.text ?? '[?]';
      // A label with an italic part cannot be painted by CSS `content`, so
      // the node view draws it from the segments instead; see `Citation`.
      if (label?.segments) attrs['data-citation-rich'] = 'true';
    }
    if (label?.unresolved) attrs['data-citation-unresolved'] = 'true';

    decorations.push(
      Decoration.node(citation.pos, citation.pos + citation.size, attrs, {
        citationSegments: label?.hidden ? undefined : label?.segments,
      })
    );
  });

  return { decorations: DecorationSet.create(doc, decorations), order: numbering.order };
}

/** Arrays compared by value, so an unchanged order does not re-render the panel. */
function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export const CitationNumbering = Extension.create<
  CitationNumberingOptions,
  CitationNumberingStorage
>({
  name: 'citationNumbering',

  addOptions() {
    return { resolveKnownKeys: () => new Set<string>(), onOrderChange: undefined };
  },

  addStorage() {
    return { order: [] };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: citationNumberingKey,

        state: {
          init: (_config, state) => {
            const { decorations, order } = buildDecorations(state.doc, extension.options);
            extension.storage.order = order;
            return decorations;
          },

          apply(tr, current, _oldState, newState) {
            const forced = tr.getMeta(citationNumberingKey) === true;
            if (!tr.docChanged && !forced) return current;

            const { decorations, order } = buildDecorations(newState.doc, extension.options);

            if (!sameOrder(order, extension.storage.order)) {
              extension.storage.order = order;
              // Deferred: `apply` runs inside the state computation, and
              // calling back into React from there would set state during a
              // dispatch that has not finished.
              const notify = extension.options.onOrderChange;
              if (notify) queueMicrotask(() => notify(order));
            }

            return decorations;
          },
        },

        props: {
          decorations(state) {
            return citationNumberingKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/** Citation keys in the order the document first cites them. */
export function getCitationOrder(editor: { storage: unknown }): string[] {
  const storage = (editor.storage as Record<string, CitationNumberingStorage | undefined>)
    .citationNumbering;
  return storage?.order ?? [];
}

/**
 * Recomputes labels after something outside the document changed — a reference
 * being added or deleted alters which citations resolve, and editing one's
 * authors or year alters its author–date label, without the document itself
 * being touched.
 */
export function refreshCitationNumbering(editor: {
  view: { state: any; dispatch: (tr: any) => void };
}) {
  const tr = editor.view.state.tr;
  tr.setMeta(citationNumberingKey, true);
  tr.setMeta('addToHistory', false);
  tr.setMeta('preventUpdate', true);
  editor.view.dispatch(tr);
}
