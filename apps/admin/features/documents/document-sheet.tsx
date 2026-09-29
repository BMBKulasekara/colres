'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { IconExternalLink, IconFileOff, IconTrash } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { CopyButton } from '../../components/feedback/copy-button';
import { EmptyState } from '../../components/feedback/empty-state';
import { ErrorBoundary } from '../../components/feedback/error-state';
import { StatusBadge } from '../../components/feedback/status-badge';
import { UserAvatar } from '../../components/user-avatar';
import { WEB_APP_URL } from '../../lib/constants';
import { formatDateTime, pluralize } from '../../lib/format';
import { ActivityFeed } from '../activity/activity-feed';
import { ContentPreview } from './content-preview';
import { DocumentContributions } from './document-contributions';
import { DocumentMetaForm } from './document-meta-form';
import { useDocumentActions } from './use-document-actions';

export function DocumentSheet({
  id,
  onClose,
}: {
  id: Id<'documents'> | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {id && (
          <ErrorBoundary title="Couldn't load this document">
            <DocumentSheetBody id={id} onClose={onClose} />
          </ErrorBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DocumentSheetBody({ id, onClose }: { id: Id<'documents'>; onClose: () => void }) {
  const doc = useQuery(api.admin.documents.get, { id });
  const { deleteOne } = useDocumentActions();

  if (doc === undefined) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <SheetTitle className="sr-only">Loading document</SheetTitle>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (doc === null) {
    return (
      <>
        <SheetTitle className="sr-only">Document not found</SheetTitle>
        <EmptyState
          icon={IconFileOff}
          title="Document not found"
          description="It may have been deleted."
          className="py-24"
        />
      </>
    );
  }

  return (
    <>
      <SheetHeader className="gap-2 border-b p-6 pr-12">
        <SheetTitle className="text-lg leading-snug">{doc.title}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status ? 'active' : 'draft'} />
            <span className="flex items-center font-mono text-xs">
              {doc._id}
              <CopyButton value={doc._id} label="Copy document ID" />
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="overview" className="flex-1 gap-0">
        <TabsList variant="line" className="w-full justify-start border-b px-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6 p-6">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Author</dt>
            <dd>
              {doc.author ? (
                <Link
                  href={`/users?open=${doc.author._id}`}
                  className="inline-flex items-center gap-2 hover:underline"
                >
                  <UserAvatar
                    name={doc.author.name}
                    imageUrl={doc.author.imageUrl}
                    className="size-5"
                  />
                  {doc.author.name}
                </Link>
              ) : (
                'Unknown'
              )}
            </dd>
            <dt className="text-muted-foreground">Organization</dt>
            <dd>
              {doc.organization ? (
                <Link
                  href={`/organizations?open=${doc.organization._id}`}
                  className="hover:underline"
                >
                  {doc.organization.name}
                </Link>
              ) : (
                'Personal'
              )}
            </dd>
            <dt className="text-muted-foreground">Template</dt>
            <dd>
              {doc.template ? (
                <Link href={`/templates/${doc.template._id}`} className="hover:underline">
                  {doc.template.name}
                  {doc.templateVersion !== undefined && (
                    <span className="text-muted-foreground"> · v{doc.templateVersion}</span>
                  )}
                </Link>
              ) : (
                (doc.templateSnapshot?.name ?? 'None')
              )}
            </dd>
            <dt className="text-muted-foreground">Citation style</dt>
            <dd className="uppercase">
              {doc.citationStyle ?? doc.templateSnapshot?.citationStyle ?? '—'}
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDateTime(doc.createdAt)}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{formatDateTime(doc.updatedAt)}</dd>
            <dt className="text-muted-foreground">Linked data</dt>
            <dd>
              {pluralize(doc.dependents.chats, 'chat message')} ·{' '}
              {pluralize(doc.dependents.comments, 'comment')} ·{' '}
              {pluralize(doc.dependents.references, 'reference')}
            </dd>
          </dl>

          <DocumentMetaForm key={`${doc.title}\u0000${doc.slug}\u0000${doc.status}`} doc={doc} />

          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4">
            <div>
              <h3 className="text-sm font-medium text-destructive">Delete document</h3>
              <p className="text-xs text-muted-foreground">
                Removes the document and everything linked to it.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={async () => {
                if (await deleteOne(doc, doc.dependents)) onClose();
              }}
            >
              <IconTrash size={15} aria-hidden="true" />
              Delete…
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="content" className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Read-only preview. Authors edit content in the app.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href={`${WEB_APP_URL}/docs/${doc.slug}`} target="_blank" rel="noreferrer">
                Open in app
                <IconExternalLink size={14} aria-hidden="true" />
              </a>
            </Button>
          </div>
          <ContentPreview html={doc.content} title={doc.title} />
        </TabsContent>

        <TabsContent value="contributions" className="p-6">
          <DocumentContributions documentId={doc._id} />
        </TabsContent>

        <TabsContent value="activity" className="p-6">
          <ActivityFeed
            compact
            filters={{ entityType: 'document', entityId: doc._id }}
            pageSize={20}
            emptyHint="No admin changes to this document yet."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
