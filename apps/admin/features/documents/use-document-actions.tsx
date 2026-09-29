'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { useConfirm } from '../../components/feedback/confirm-dialog';
import { errorMessage } from '../../lib/convex-error';
import { pluralize } from '../../lib/format';

/** Every write the Documents screen makes, with its confirmation and toasts. */
export function useDocumentActions() {
  const confirm = useConfirm();
  const update = useMutation(api.documents.adminUpdateDocument);
  const remove = useMutation(api.documents.adminDeleteDocument);
  const bulkSetStatus = useMutation(api.admin.documents.bulkSetStatus);
  const bulkDelete = useMutation(api.admin.documents.bulkDelete);

  const setStatus = async (doc: { _id: Id<'documents'>; title: string }, status: boolean) => {
    try {
      await update({ id: doc._id, status });
      toast.success(`"${doc.title}" is now ${status ? 'active' : 'a draft'}`, {
        action: { label: 'Undo', onClick: () => void update({ id: doc._id, status: !status }) },
      });
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const deleteOne = async (
    doc: { _id: Id<'documents'>; title: string; slug: string },
    dependents?: { chats: number; comments: number; references: number }
  ) => {
    const ok = await confirm({
      title: 'Delete this document?',
      description: 'This permanently removes the document. It cannot be undone.',
      impact: (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{doc.title}</span>
          <span className="text-muted-foreground">
            {dependents
              ? `Also removes ${pluralize(dependents.chats, 'chat message')}, ${pluralize(dependents.comments, 'comment')} and ${pluralize(dependents.references, 'reference')}.`
              : 'Its chat messages, comments and references are removed too.'}
          </span>
        </div>
      ),
      confirmText: 'Delete document',
      destructive: true,
      requireTyping: doc.slug,
    });
    if (!ok) return false;
    try {
      await remove({ id: doc._id });
      toast.success(`Deleted "${doc.title}"`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const setStatusMany = async (ids: string[], status: boolean) => {
    try {
      const { changed } = await bulkSetStatus({ ids: ids as Id<'documents'>[], status });
      toast.success(`${pluralize(changed, 'document')} set to ${status ? 'active' : 'draft'}`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  const deleteMany = async (ids: string[]) => {
    const ok = await confirm({
      title: `Delete ${pluralize(ids.length, 'document')}?`,
      description:
        'Their chat messages, comments and references are removed too. This cannot be undone.',
      confirmText: `Delete ${pluralize(ids.length, 'document')}`,
      destructive: true,
      requireTyping: 'delete',
    });
    if (!ok) return false;
    try {
      const { deleted } = await bulkDelete({ ids: ids as Id<'documents'>[] });
      toast.success(`Deleted ${pluralize(deleted, 'document')}`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  return { update, setStatus, deleteOne, setStatusMany, deleteMany };
}
