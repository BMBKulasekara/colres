'use client';

import { api } from '@repo/convex/_generated/api';
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
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { useAction, useQuery } from 'convex/react';
import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TrashRow } from './TrashRow';

/** The bin of one workspace: an organization's, or the personal one when `orgId` is absent. */
export function TrashList({ orgId }: { orgId?: string }) {
  const items = useQuery(api.trash.listTrash, { orgId });
  const emptyTrash = useAction(api.trash.emptyTrash);

  const [confirming, setConfirming] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (items === undefined) {
    return (
      <output className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the bin">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </output>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center">
        <Trash2 className="size-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">Nothing in the bin</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Documents you move to the bin stay here for 30 days, then they are deleted for good.
        </p>
      </div>
    );
  }

  const erasable = items.filter((item) => item.canDeleteForever).length;

  const empty = async () => {
    setEmptying(true);
    setMessage(null);
    try {
      const { deleted, kept } = await emptyTrash({ orgId });
      setMessage(
        kept > 0
          ? `Deleted ${deleted}. ${kept} stayed, because only their authors can delete them forever.`
          : null
      );
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'The bin could not be emptied.');
    } finally {
      setEmptying(false);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-label="Documents in the bin">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'document' : 'documents'} · deleted for good after 30
          days
        </p>
        {erasable > 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={emptying}
            onClick={() => setConfirming(true)}
            className="text-destructive hover:text-destructive"
          >
            {emptying ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Empty bin
          </Button>
        )}
      </div>

      {message && <output className="block text-sm text-muted-foreground">{message}</output>}

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <TrashRow key={item.documentId} item={item} />
        ))}
      </ul>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the bin?</AlertDialogTitle>
            <AlertDialogDescription>
              {erasable === items.length
                ? `All ${items.length} documents will be deleted for good, with their references, comments and chat.`
                : `${erasable} of ${items.length} documents will be deleted for good. The rest can only be deleted by their authors.`}{' '}
              This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void empty()}>
              Empty bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
