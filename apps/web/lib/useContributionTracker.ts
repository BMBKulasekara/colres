import { api } from '@repo/convex/_generated/api';
import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { ReplaceStep } from '@tiptap/pm/transform';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';

const FLUSH_MS = 60_000;
/** y-prosemirror tags transactions that apply someone else's edits with this meta. */
const Y_SYNC_META = 'y-sync$';

type Pending = {
  wordsAdded: number;
  charsAdded: number;
  charsDeleted: number;
  minutes: Set<number>;
};

const empty = (): Pending => ({
  wordsAdded: 0,
  charsAdded: 0,
  charsDeleted: 0,
  minutes: new Set(),
});

/**
 * Counts this user's own edits and flushes them to Convex about once a
 * minute, so contribution tracking costs one small write per minute instead
 * of one per keystroke. Remote edits arriving through Liveblocks are skipped,
 * since each collaborator's browser reports its own.
 */
export function useContributionTracker(editor: Editor | null, documentId: string) {
  const record = useMutation(api.contributions.record);
  const pending = useRef<Pending>(empty());

  useEffect(() => {
    if (!editor) return;

    const onTransaction = ({ transaction: tr }: { transaction: Transaction }) => {
      if (!tr.docChanged || tr.getMeta(Y_SYNC_META)?.isChangeOrigin) return;
      const p = pending.current;
      tr.steps.forEach((step, i) => {
        const before = tr.docs[i];
        if (!(step instanceof ReplaceStep) || !before) return;
        const { from, to, slice } = step;
        const inserted = slice.content.textBetween(0, slice.content.size, ' ');
        const deleted = to > from ? before.textBetween(from, to, ' ') : '';
        // A word is counted where one starts, so typing "hello" letter by letter
        // counts once: only the "h" follows whitespace.
        let prev = from > 0 ? before.textBetween(Math.max(0, from - 1), from, ' ') || ' ' : ' ';
        for (const ch of inserted) {
          if (/\S/.test(ch) && /\s/.test(prev)) p.wordsAdded++;
          prev = ch;
        }
        p.charsAdded += inserted.length;
        p.charsDeleted += deleted.length;
      });
      p.minutes.add(Math.floor(Date.now() / 60_000));
    };

    const flush = () => {
      const p = pending.current;
      if (!p.charsAdded && !p.charsDeleted && !p.minutes.size) return;
      pending.current = empty();
      record({
        documentId,
        wordsAdded: p.wordsAdded,
        charsAdded: p.charsAdded,
        charsDeleted: p.charsDeleted,
        activeMinutes: p.minutes.size,
      }).catch(() => {
        // Put the counts back so the next flush retries them.
        const cur = pending.current;
        cur.wordsAdded += p.wordsAdded;
        cur.charsAdded += p.charsAdded;
        cur.charsDeleted += p.charsDeleted;
        for (const m of p.minutes) cur.minutes.add(m);
      });
    };

    const onHide = () => document.visibilityState === 'hidden' && flush();
    editor.on('transaction', onTransaction);
    const timer = setInterval(flush, FLUSH_MS);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    return () => {
      editor.off('transaction', onTransaction);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [editor, documentId, record]);
}
