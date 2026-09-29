'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useConfirm } from '../../components/feedback/confirm-dialog';
import { errorMessage } from '../../lib/convex-error';
import { pluralize } from '../../lib/format';

type TemplateRef = { _id: Id<'templates'>; name: string; usageCount: number };
type Status = 'draft' | 'published';

export function useTemplateActions() {
  const router = useRouter();
  const confirm = useConfirm();

  // Toggles flip in the list immediately and roll back if the server refuses.
  const setStatusMutation = useMutation(api.templates.adminSetTemplateStatus).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.templates.adminListTemplates, {});
      if (list) {
        store.setQuery(
          api.templates.adminListTemplates,
          {},
          list.map((t) => (t._id === args.id ? { ...t, status: args.status } : t))
        );
      }
    }
  );
  const setFeaturedMutation = useMutation(api.templates.adminSetFeatured).withOptimisticUpdate(
    (store, args) => {
      const list = store.getQuery(api.templates.adminListTemplates, {});
      if (list) {
        store.setQuery(
          api.templates.adminListTemplates,
          {},
          list.map((t) => (t._id === args.id ? { ...t, featured: args.featured } : t))
        );
      }
    }
  );
  const duplicateMutation = useMutation(api.templates.adminDuplicateTemplate);
  const removeMutation = useMutation(api.templates.adminDeleteTemplate);

  const setStatus = async (template: TemplateRef, status: Status) => {
    try {
      await setStatusMutation({ id: template._id, status });
      toast.success(
        status === 'published'
          ? `Published "${template.name}" to the gallery`
          : `Unpublished "${template.name}"`,
        {
          action: {
            label: 'Undo',
            onClick: () => {
              setStatusMutation({
                id: template._id,
                status: status === 'published' ? 'draft' : 'published',
              }).catch((error: unknown) => toast.error(errorMessage(error)));
            },
          },
        }
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const setFeatured = async (template: TemplateRef, featured: boolean) => {
    try {
      await setFeaturedMutation({ id: template._id, featured });
      toast.success(
        featured ? `"${template.name}" is featured` : `"${template.name}" is no longer featured`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const duplicate = async (template: TemplateRef) => {
    try {
      const id = await duplicateMutation({ id: template._id });
      toast.success('Duplicated as a draft');
      router.push(`/templates/${id}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  /** Resolves true when the template is gone. */
  const remove = async (template: TemplateRef): Promise<boolean> => {
    if (template.usageCount > 0) {
      const unpublish = await confirm({
        title: "This template can't be deleted",
        description: `${pluralize(template.usageCount, 'document')} were created from "${template.name}". Unpublish it to hide it from the gallery instead; those documents keep working either way.`,
        confirmText: 'Unpublish instead',
      });
      if (unpublish) await setStatus(template, 'draft');
      return false;
    }

    const ok = await confirm({
      title: `Delete "${template.name}"?`,
      description: 'The template and its thumbnail are removed permanently.',
      confirmText: 'Delete template',
      destructive: true,
      requireTyping: template.name,
    });
    if (!ok) return false;
    try {
      await removeMutation({ id: template._id });
      toast.success(`Deleted "${template.name}"`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };

  return { setStatus, setFeatured, duplicate, remove };
}
