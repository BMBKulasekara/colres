'use client';

import { api } from '@repo/convex/_generated/api';
import type { Doc, Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { IconArrowLeft, IconCopy, IconDots, IconFileOff, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '../../../components/feedback/empty-state';
import { StatusBadge } from '../../../components/feedback/status-badge';
import { PageBody } from '../../../components/page-header';
import { useBreadcrumbLabel } from '../../../components/shell/breadcrumbs';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useUrlState } from '../../../hooks/use-url-state';
import { errorMessage } from '../../../lib/convex-error';
import { pluralize } from '../../../lib/format';
import { useTemplateActions } from '../use-template-actions';
import { ContentTab } from './content-tab';
import { FieldsTab } from './fields-tab';
import { GeneralTab } from './general-tab';
import { LatexTab } from './latex-tab';
import { LicenseTab } from './license-tab';
import { SaveBar } from './save-bar';
import { SectionsTab } from './sections-tab';
import { TABS, type TabId, toForm } from './types';
import { useTemplateForm } from './use-template-form';
import { useUnsavedChangesGuard } from './use-unsaved-changes-guard';

export function TemplateEditor({ id }: { id: Id<'templates'> }) {
  const template = useQuery(api.templates.adminGetTemplate, { id });
  const router = useRouter();
  useBreadcrumbLabel(template?.name);

  if (template === undefined) {
    return (
      <PageBody>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-96 w-full" />
      </PageBody>
    );
  }
  if (template === null) {
    return (
      <PageBody>
        <EmptyState
          icon={IconFileOff}
          title="Template not found"
          description="It may have been deleted."
          action={<Button onClick={() => router.push('/templates')}>Back to templates</Button>}
          className="py-24"
        />
      </PageBody>
    );
  }

  // The form seeds once per template; later server updates don't clobber edits.
  return <EditorBody key={template._id} template={template} />;
}

function EditorBody({
  template,
}: {
  template: Doc<'templates'> & { thumbnailUrl: string | null };
}) {
  const url = useUrlState();
  const router = useRouter();
  const editor = useTemplateForm(toForm(template));
  const update = useMutation(api.templates.adminUpdateTemplate);
  const actions = useTemplateActions();
  const [saving, setSaving] = useState(false);

  const tabParam = url.get('tab');
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'general';
  const errorCount = Object.keys(editor.errors).length;

  useUnsavedChangesGuard(editor.dirty);

  const save = async () => {
    if (!editor.dirty || saving) return;
    if (errorCount > 0) {
      toast.error(`Fix ${pluralize(errorCount, 'error')} before saving`);
      const firstBad = TABS.find((t) => editor.errorTabs.has(t.id));
      if (firstBad) url.set({ tab: firstBad.id === 'general' ? null : firstBad.id });
      return;
    }
    const snapshot = editor.form;
    const { thumbnailId, ...rest } = editor.patch;
    const clearThumbnail = 'thumbnailId' in editor.patch && thumbnailId === undefined;
    setSaving(true);
    try {
      const saved = await update({
        id: template._id,
        ...(rest as Omit<Parameters<typeof update>[0], 'id'>),
        ...(thumbnailId ? { thumbnailId: thumbnailId as Id<'_storage'> } : {}),
        ...(clearThumbnail ? { clearThumbnail: true } : {}),
      });
      editor.markSaved(snapshot);
      toast.success(
        saved && saved.version !== template.version
          ? `Saved as version ${saved.version}`
          : 'Template saved'
      );
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save the template"));
    } finally {
      setSaving(false);
    }
  };

  useHotkey('mod+s', () => void save());

  return (
    <PageBody>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href="/templates"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <IconArrowLeft size={14} aria-hidden="true" />
            Templates
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="truncate">{editor.form.name || 'Untitled template'}</span>
            <StatusBadge status={template.status} />
            <span className="rounded border px-1.5 text-xs font-medium text-muted-foreground">
              v{template.version}
            </span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Used by {pluralize(template.usageCount, 'document')}. Edits apply to new documents only.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              void actions.setStatus(
                template,
                template.status === 'published' ? 'draft' : 'published'
              )
            }
          >
            {template.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <IconDots size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => void actions.duplicate(template)}>
                <IconCopy aria-hidden="true" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={async () => {
                  if (await actions.remove(template)) router.push('/templates');
                }}
              >
                <IconTrash aria-hidden="true" />
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => url.set({ tab: value === 'general' ? null : value })}
        className="gap-6"
      >
        <TabsList variant="line" className="w-full justify-start overflow-x-auto border-b">
          {TABS.map((t) => {
            const count =
              t.id === 'sections'
                ? editor.form.sections.length
                : t.id === 'fields'
                  ? editor.form.fields.length
                  : undefined;
            return (
              <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
                {t.label}
                {count !== undefined && (
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                )}
                {editor.errorTabs.has(t.id) ? (
                  <>
                    <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
                    <span className="sr-only">(has errors)</span>
                  </>
                ) : editor.dirtyTabs.has(t.id) ? (
                  <>
                    <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                    <span className="sr-only">(unsaved changes)</span>
                  </>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="general">
          <GeneralTab editor={editor} thumbnailUrl={template.thumbnailUrl} />
        </TabsContent>
        <TabsContent value="content">
          <ContentTab editor={editor} />
        </TabsContent>
        <TabsContent value="sections">
          <SectionsTab editor={editor} />
        </TabsContent>
        <TabsContent value="fields">
          <FieldsTab editor={editor} />
        </TabsContent>
        <TabsContent value="latex">
          <LatexTab editor={editor} />
        </TabsContent>
        <TabsContent value="license">
          <LicenseTab editor={editor} />
        </TabsContent>
      </Tabs>

      {editor.dirty && (
        <SaveBar
          dirtyTabs={editor.dirtyTabs}
          errorCount={errorCount}
          saving={saving}
          onSave={() => void save()}
          onDiscard={editor.discard}
        />
      )}
    </PageBody>
  );
}
