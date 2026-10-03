'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { daysUntilPurge } from '@repo/convex/trash/policy';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@repo/ui/components/ui/alert-dialog';
import { Button } from '@repo/ui/components/ui/button';
import { useAction, useMutation } from 'convex/react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatRelativeTime } from '../../lib/relativeTime';

export interface TrashItem {
  documentId: Id<'documents'>;
  title: string;
  templateName: string | null;
  deletedAt: number;
  purgeAt: number;
  deletedByName: string;
  authorName: string;
  isAuthor: boolean;
  canDeleteForever: boolean;
}

/** One binned document: what it is, who binned it, and what can be done with it. */
export function TrashRow({ item }: { item: TrashItem }) {
  const restore = useMutation(api.trash.restore);
  const deleteForever = useAction(api.trash.deleteForever);

  const [busy, setBusy] = useState<'restore' | 'delete' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'restore' | 'delete', task: () => Promise<unknown>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
      setBusy(null);
    }
  };

  const daysLeft = daysUntilPurge(item.purgeAt, Date.now());

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{item.title || 'Untitled Document'}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Deleted by {item.deletedByName} · {formatRelativeTime(item.deletedAt)}
          {!item.isAuthor && <> · written by {item.authorName}</>}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {daysLeft === 0
            ? 'Deleted for good at the next clean-up'
            : `Deleted for good in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => run('restore', () => restore({ id: item.documentId }))}
        >
          {busy === 'restore' ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Restore
        </Button>

        {item.canDeleteForever ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy !== null}
            onClick={() => setConfirming(true)}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Delete forever
          </Button>
        ) : (
          <span className="max-w-40 text-xs text-muted-foreground">
            Only the author can delete this forever
          </span>
        )}
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete forever?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{item.title || 'Untitled Document'}&rdquo; and its references, comments and
              chat will be deleted for everyone. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run('delete', () => deleteForever({ id: item.documentId }))}
            >
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
