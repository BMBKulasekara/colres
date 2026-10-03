import { Extension } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  type FloatOccurrence,
  type FloatScheme,
  numberFloats,
  uncitedFloats,
} from '../../lib/floatNumbering';
import { floatKindOf, newFloatId } from './FloatNodes';

/**
 * Numbers every figure and table, and every mention of them in the prose.
 *
 * The numbering itself is a pure function of document order
 * (`lib/floatNumbering.ts`); this extension is only the part that has to touch
 * ProseMirror — walking the document, and painting the result.
 *
 * Like citation numbering, the labels are decorations rather than text written
 * into the document. The reason is the same: "Fig. 3" is derived data. Writing
 * it in would mean every figure inserted near the top of a paper rewrites the
 * caption of every figure below it, re-broadcasting half the document through
 * Yjs and leaving stale numbers in any client that had not recomputed. As a
 * decoration it is simply recomputed, everywhere, from the same document.
 *
 * One pass numbers both the captions and the cross-references, so the two
 * cannot disagree. An earlier sketch let CSS counters number the captions —
 * which the section headings already do — and computed the cross-references
 * separately in JavaScript; that is two sources of truth for one number, and
 * the day they diverge the paper is wrong in a way nobody would notice.
 */

export interface FloatNumberingOptions {
  /**
   * How floats are labelled — "Fig. 1" / "TABLE I", or APA's "Figure 1" /
   * "Table 1". A function so it can follow the document's format without the
   * editor being rebuilt.
   */
  resolveScheme?: () => FloatScheme;
  /**
   * Reports floats the prose never refers to.
   *
   * IEEE requires every figure and table to be cited in the text, and APA
   * requires each to be called out before it appears, so this is a defect in
   * the paper rather than a preference — and an invisible one, which
   * is why it is surfaced rather than left for a reviewer to find.
   */
  onUncitedChange?: (uncited: { id: string; label: string }[]) => void;
}

interface FloatNumberingStorage {
  /** Floats in document order, with their labels, for the insert menu. */
  floats: { id: string; label: string; caption: string }[];
  uncited: { id: string; label: string }[];
}

const floatNumberingKey = new PluginKey<DecorationSet>('floatNumbering');
const uniqueFloatIdsKey = new PluginKey('uniqueFloatIds');

/** The meta key y-prosemirror tags the changes it applies from the shared document with. */
const REMOTE_CHANGE_META = 'y-sync$';

/**
 * Gives every float an id of its own.
 *
 * Copying a figure or table and pasting it carries the original's id along, so
 * two floats would share one number and one cross-reference target. The first
 * keeps the id, which is what existing cross-references point at; every later
 * duplicate, and any float pasted in without an id, gets a fresh one.
 *
 * Only changes made in this browser are repaired here. A collaborator's paste
 * is repaired in theirs and arrives already unique, so two browsers never
 * race to rename the same float.
 */
function uniqueFloatIdsPlugin() {
  return new Plugin({
    key: uniqueFloatIdsKey,
    appendTransaction(transactions, _oldState, newState) {
      const hasLocalEdit = transactions.some(
        (tr) => tr.docChanged && !tr.getMeta(REMOTE_CHANGE_META)?.isChangeOrigin
      );
      if (!hasLocalEdit) return null;

      const seen = new Set<string>();
      const repair = newState.tr;
      newState.doc.descendants((node, pos) => {
        const kind = floatKindOf(node.type.name);
        if (!kind) return true;

        const id = node.attrs.floatId as string | null;
        if (id && !seen.has(id)) {
          seen.add(id);
        } else {
          const fresh = newFloatId(kind);
          seen.add(fresh);
          repair.setNodeAttribute(pos, 'floatId', fresh);
        }
        return true;
      });
      return repair.docChanged ? repair : null;
    },
  });
}

interface FoundFloat extends FloatOccurrence {
  pos: number;
  size: number;
  /** The caption's text, so the insert menu can show which figure is which. */
  caption: string;
}

interface FoundReference {
  pos: number;
  size: number;
  floatId: string;
}

/** Every float and every cross-reference, in document order. */
function scan(doc: PMNode): { floats: FoundFloat[]; references: FoundReference[] } {
  const floats: FoundFloat[] = [];
  const references: FoundReference[] = [];

  doc.descendants((node, pos) => {
    const kind = floatKindOf(node.type.name);
    if (kind) {
      floats.push({
        id: node.attrs.floatId ?? '',
        kind,
        pos,
        size: node.nodeSize,
        caption: captionTextOf(node),
      });
      // Keep descending: a float may contain cross-references in its caption,
      // which is how "adapted from Fig. 1" in a caption stays correct.
      return true;
    }

    if (node.type.name === 'crossReference') {
      references.push({ pos, size: node.nodeSize, floatId: node.attrs.floatId ?? '' });
      return false;
    }

    return true;
  });

  return { floats, references };
}

/** The text of a float's caption child, for menus and warnings. */
function captionTextOf(float: PMNode): string {
  let text = '';
  float.forEach((child) => {
    if (child.type.name === 'floatCaption') text = child.textContent;
  });
  return text;
}

function buildDecorations(doc: PMNode, scheme: FloatScheme) {
  const { floats, references } = scan(doc);
  const labels = numberFloats(floats, scheme);

  const decorations: Decoration[] = [];

  for (const float of floats) {
    const caption = labels.captionLabels.get(float.id);
    decorations.push(
      Decoration.node(float.pos, float.pos + float.size, {
        // Drawn by CSS on the caption, which is why the label goes on the
        // float rather than on the caption node: the caption's own ::before
        // cannot see an attribute on itself that the float knows about.
        'data-float-label': caption ?? '',
      })
    );
  }

  const referencedIds = new Set<string>();

  for (const reference of references) {
    const label = labels.referenceLabels.get(reference.floatId);
    if (label) referencedIds.add(reference.floatId);

    decorations.push(
      Decoration.node(reference.pos, reference.pos + reference.size, {
        'data-xref-label': label ?? '??',
        // A reference whose figure has been deleted. Shown, not hidden: the
        // author is the only one who can decide what it should have said.
        ...(label ? {} : { 'data-xref-dangling': 'true' }),
      })
    );
  }

  const uncited = uncitedFloats(floats, referencedIds).map((float) => ({
    id: float.id,
    label: labels.captionLabels.get(float.id) ?? '',
  }));

  return {
    decorations: DecorationSet.create(doc, decorations),
    floats: floats.map((float) => ({
      id: float.id,
      label: labels.referenceLabels.get(float.id) ?? '',
      caption: float.caption,
    })),
    uncited,
  };
}

/** Compared by value, so an unchanged list does not re-render the toolbar. */
function sameUncited(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
  return a.length === b.length && a.every((item, index) => item.id === b[index]?.id);
}

export const FloatNumbering = Extension.create<FloatNumberingOptions, FloatNumberingStorage>({
  name: 'floatNumbering',

  addOptions() {
    return { resolveScheme: () => 'ieee' as FloatScheme, onUncitedChange: undefined };
  },

  addStorage() {
    return { floats: [], uncited: [] };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      uniqueFloatIdsPlugin(),
      new Plugin({
        key: floatNumberingKey,

        state: {
          init: (_config, state) => {
            const { decorations, floats, uncited } = buildDecorations(
              state.doc,
              extension.options.resolveScheme?.() ?? 'ieee'
            );
            extension.storage.floats = floats;
            extension.storage.uncited = uncited;
            return decorations;
          },

          apply(tr, current, _oldState, newState) {
            if (!tr.docChanged) return current;

            const { decorations, floats, uncited } = buildDecorations(
              newState.doc,
              extension.options.resolveScheme?.() ?? 'ieee'
            );
            extension.storage.floats = floats;

            if (!sameUncited(uncited, extension.storage.uncited)) {
              extension.storage.uncited = uncited;
              // Deferred: `apply` runs inside the state computation, and
              // calling into React from there would set state during a
              // dispatch that has not finished.
              const notify = extension.options.onUncitedChange;
              if (notify) queueMicrotask(() => notify(uncited));
            }

            return decorations;
          },
        },

        props: {
          decorations(state) {
            return floatNumberingKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/** Floats in document order with their current labels, for the insert menu. */
export function getFloats(editor: { storage: unknown }): FloatNumberingStorage['floats'] {
  const storage = (editor.storage as Record<string, FloatNumberingStorage | undefined>)
    .floatNumbering;
  return storage?.floats ?? [];
}
