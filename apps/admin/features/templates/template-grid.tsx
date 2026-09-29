'use client';

import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Switch } from '@repo/ui/components/ui/switch';
import Link from 'next/link';
import { StatusBadge } from '../../components/feedback/status-badge';
import { categoryLabel } from '../../lib/constants';
import { formatNumber } from '../../lib/format';
import { placeholderKeys } from '../../lib/placeholders';
import { type TemplateRow, TemplateRowMenu, TemplateThumb } from './columns';
import type { useTemplateActions } from './use-template-actions';

/** Thumbnail cards, closer to how templates appear in the user-facing gallery. */
export function TemplateGrid({
  templates,
  isLoading,
  actions,
  empty,
}: {
  templates: TemplateRow[];
  isLoading: boolean;
  actions: ReturnType<typeof useTemplateActions>;
  empty: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {placeholderKeys(8, 'i').map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }
  if (templates.length === 0) return <div className="surface">{empty}</div>;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {templates.map((template) => (
        <li
          key={template._id}
          className="group surface surface-hover relative flex flex-col overflow-hidden"
        >
          <TemplateThumb
            template={template}
            className="aspect-[4/3] w-full rounded-none border-0 border-b"
          />
          <div className="flex flex-1 flex-col gap-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <Link
                href={`/templates/${template._id}`}
                className="min-w-0 font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:underline"
              >
                <span className="line-clamp-2">{template.name}</span>
              </Link>
              <div className="relative z-10">
                <TemplateRowMenu template={template} actions={actions} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {categoryLabel(template.category)} · {formatNumber(template.usageCount)} uses
            </p>
            <div className="mt-auto flex items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={template.status} />
                {template.featured && <StatusBadge status="featured" />}
              </div>
              <Switch
                className="relative z-10"
                checked={template.status === 'published'}
                onCheckedChange={(checked) =>
                  void actions.setStatus(template, checked ? 'published' : 'draft')
                }
                aria-label={`Published: ${template.name}`}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
