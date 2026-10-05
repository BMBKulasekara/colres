'use client';
import { useAuth, useOrganization, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import type { Doc, Id } from '@repo/convex/_generated/dataModel';
import { deadlineLabel } from '@repo/convex/goals/policy';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { useMutation, useQuery } from 'convex/react';
import {
  CalendarClock,
  ChevronDown,
  ExternalLink,
  FilePlus2,
  FileUp,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  Pilcrow,
  Plus,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { DocumentSearchInput, DocumentSearchResults } from '../../components/DocumentSearch';
import { DocxImport, type DocxImportHandle } from '../../components/DocxImport';
import { SharedWithMe } from '../../components/SharedWithMe';
import { StatusChip } from '../../components/StatusChip';
import { CreateDocumentWizard } from '../../components/templates/CreateDocumentWizard';
import { documentStatus } from '../../lib/documentStatus';
import { formatRelativeTime } from '../../lib/relativeTime';

/** How many templates the split button and the empty state offer directly. */
const QUICK_TEMPLATE_COUNT = 3;

/**
 * What the create wizard is open on: the template chooser, a preselected
 * template, or nothing. `null` preselects the blank document.
 */
type WizardTarget = { templateId?: string | null } | null;

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Docs() {
  const { user } = useUser();
  const { isLoaded } = useAuth();
  const { organization } = useOrganization();
  const router = useRouter();

  // The Clerk id is no longer sent: Convex reads the caller's identity from
  // the verified token, so it cannot be spoofed by passing someone else's.
  const documents = useQuery(
    api.documents.getAllDocumentsByUserId,
    user?.id ? { orgId: organization?.id } : 'skip'
  );

  // Featured templates come first, so the head of the list is the right set
  // to offer as shortcuts.
  const templates = useQuery(
    api.templates.listTemplates,
    user?.id ? { orgId: organization?.id } : 'skip'
  );
  const quickTemplates = (templates ?? []).slice(0, QUICK_TEMPLATE_COUNT);

  const createDoc = useMutation(api.documents.createDocument);
  const moveToTrash = useMutation(api.trash.moveToTrash);

  const [wizard, setWizard] = useState<WizardTarget>(null);
  const docxImport = useRef<DocxImportHandle>(null);
  const [isCreatingBlank, setIsCreatingBlank] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Doc<'documents'> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const sortedDocuments = useMemo(
    () => [...(documents ?? [])].sort((a, b) => b.updatedAt - a.updatedAt),
    [documents]
  );

  /** The split button's main action: straight into an empty document. */
  const createBlank = async () => {
    if (isCreatingBlank) return;
    setIsCreatingBlank(true);
    try {
      const result = await createDoc({ title: 'Untitled Document', orgId: organization?.id });
      router.push(`/docs/${result.slug}`);
    } catch (error) {
      console.error('Failed to create document:', error);
      setIsCreatingBlank(false);
    }
  };

  const handleMoveToTrash = async (id: Id<'documents'>) => {
    try {
      await moveToTrash({ id });
    } catch (error) {
      console.error('Failed to move document to the bin:', error);
    }
  };

  const isLoading = !isLoaded || documents === undefined;
  const now = new Date();

  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-2">
            <SidebarTrigger className="-ml-1 mt-0.5 md:hidden" aria-label="Open navigation" />
            <div>
              <p className="text-sm text-muted-foreground">
                {now.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {greeting(now.getHours())}
                {user?.firstName ? `, ${user.firstName}` : ''}
              </h1>
              {organization && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Documents in {organization.name}
                </p>
              )}
            </div>
          </div>

          <NewDocumentButton
            isCreating={isCreatingBlank}
            quickTemplates={quickTemplates}
            onCreateBlank={createBlank}
            onUseTemplate={(templateId) => setWizard({ templateId })}
            onBrowseTemplates={() => setWizard({})}
            onImportDocx={() => docxImport.current?.open()}
          />
          <DocxImport ref={docxImport} orgId={organization?.id} />
        </header>

        {isLoading ? (
          <DocumentGridSkeleton />
        ) : sortedDocuments.length === 0 ? (
          <FirstRunEmptyState
            quickTemplates={quickTemplates}
            onUseTemplate={(templateId) => setWizard({ templateId })}
            onCreateBlank={createBlank}
            isCreating={isCreatingBlank}
          />
        ) : (
          <>
            <DocumentSearchInput value={searchQuery} onChange={setSearchQuery} />
            {searchQuery.trim() ? (
              <DocumentSearchResults
                query={searchQuery}
                orgId={organization?.id}
                documents={sortedDocuments}
              />
            ) : (
              <section aria-labelledby="library-heading" className="flex flex-col gap-3">
                <h2
                  id="library-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Documents
                </h2>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedDocuments.map((doc) => (
                    <li key={doc._id}>
                      <DocumentCard document={doc} onDelete={() => setPendingDelete(doc)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {!searchQuery.trim() && <SharedWithMe />}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to bin?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; moves to the bin for everyone who shares it. It
              can be restored from the Bin for 30 days, then it is deleted for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => pendingDelete && handleMoveToTrash(pendingDelete._id)}
            >
              Move to bin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {wizard && (
        <CreateDocumentWizard
          // Remounted per target so the wizard seeds its state from it.
          key={wizard.templateId === undefined ? '__chooser__' : (wizard.templateId ?? '__blank__')}
          open
          onOpenChange={(next) => !next && setWizard(null)}
          initialTemplateId={wizard.templateId}
        />
      )}
    </div>
  );
}

type QuickTemplate = { _id: string; name: string };

/**
 * The main click opens a blank document; the caret offers the templates most
 * worth starting from and the full gallery.
 */
function NewDocumentButton({
  isCreating,
  quickTemplates,
  onCreateBlank,
  onUseTemplate,
  onBrowseTemplates,
  onImportDocx,
}: {
  isCreating: boolean;
  quickTemplates: QuickTemplate[];
  onCreateBlank: () => void;
  onUseTemplate: (templateId: string) => void;
  onBrowseTemplates: () => void;
  onImportDocx: () => void;
}) {
  return (
    <div className="flex items-center self-start sm:self-auto">
      <Button onClick={onCreateBlank} disabled={isCreating} className="rounded-r-none">
        {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
        New document
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="rounded-l-none border-l border-primary-foreground/25 px-2"
            aria-label="More ways to start a document"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {quickTemplates.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Start from a template
              </DropdownMenuLabel>
              {quickTemplates.map((template) => (
                <DropdownMenuItem key={template._id} onSelect={() => onUseTemplate(template._id)}>
                  <LayoutTemplate />
                  {template.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={onBrowseTemplates}>
            <LayoutTemplate />
            Browse all templates…
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/docs/templates">
              <ExternalLink />
              Open template gallery
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onImportDocx}>
            <FileUp />
            Import Word document…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * One document in the library. The whole card is the link; the menu sits
 * above it so its clicks do not open the document.
 */
function DocumentCard({
  document,
  onDelete,
}: {
  document: Doc<'documents'>;
  onDelete: () => void;
}) {
  const href = `/docs/${document.slug}`;

  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-xs transition-shadow duration-150 ease-out focus-within:ring-2 focus-within:ring-ring hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-accent-foreground">
          {document.templateSnapshot?.name ?? 'Blank document'}
        </span>
        <StatusChip status={documentStatus(document.status)} />
      </div>

      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
        {/* The stretched link covers the card, so the title is what a screen
            reader announces for it. */}
        <Link
          href={href}
          className="outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
        >
          {document.title}
        </Link>
      </h3>

      <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">Edited {formatRelativeTime(document.updatedAt)}</span>
          {document.deadline !== undefined && <DeadlineChip deadline={document.deadline} />}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${document.title}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={href} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open in new tab
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Move to bin…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

/** "Due in 3 days" on a card: amber within three days, red once overdue. */
function DeadlineChip({ deadline }: { deadline: number }) {
  const now = Date.now();
  const tone =
    deadline < now
      ? 'bg-destructive/10 text-destructive'
      : deadline - now < 3 * 24 * 60 * 60 * 1000
        ? 'bg-warning/12 text-warning'
        : 'bg-muted text-muted-foreground';
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${tone}`}
      title={new Date(deadline).toLocaleDateString(undefined, { dateStyle: 'full' })}
    >
      <CalendarClock className="size-3" aria-hidden="true" />
      {deadlineLabel(deadline, now)}
    </span>
  );
}

/** The loading state, in the final card shape so nothing jumps when data arrives. */
function DocumentGridSkeleton() {
  return (
    <output className="flex flex-col gap-3" aria-busy="true" aria-label="Loading documents">
      <Skeleton className="h-3 w-24" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-35 flex-col gap-4 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex justify-between">
              <Skeleton className="h-5 w-28 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-auto h-3 w-24" />
          </div>
        ))}
      </div>
    </output>
  );
}

/** Replaces the frowning "No documents found" with a way to start. */
function FirstRunEmptyState({
  quickTemplates,
  onUseTemplate,
  onCreateBlank,
  isCreating,
}: {
  quickTemplates: QuickTemplate[];
  onUseTemplate: (templateId: string) => void;
  onCreateBlank: () => void;
  isCreating: boolean;
}) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
        <Pilcrow className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl font-semibold text-foreground">Start your first paper</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Pick a format and Colres sets up the sections, word budgets and citation style for you.
        </p>
      </div>

      {quickTemplates.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {quickTemplates.map((template) => (
            <Button
              key={template._id}
              variant="outline"
              onClick={() => onUseTemplate(template._id)}
            >
              <LayoutTemplate />
              {template.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        <Link href="/docs/templates" className="font-medium text-primary hover:underline">
          Browse all templates
        </Link>
        <span aria-hidden="true" className="text-border">
          |
        </span>
        <button
          type="button"
          onClick={onCreateBlank}
          disabled={isCreating}
          className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline disabled:opacity-50"
        >
          <FilePlus2 className="size-4" aria-hidden="true" />
          Blank document
        </button>
      </div>
    </section>
  );
}
