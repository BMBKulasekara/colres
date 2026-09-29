'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@repo/ui/components/ui/sheet';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { IconBuildingOff } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { CopyButton } from '../../components/feedback/copy-button';
import { EmptyState } from '../../components/feedback/empty-state';
import { ErrorBoundary } from '../../components/feedback/error-state';
import { StatusBadge } from '../../components/feedback/status-badge';
import { Callout } from '../../components/form-field';
import { RelativeTime } from '../../components/relative-time';
import { UserAvatar, UserCell } from '../../components/user-avatar';
import { formatDate } from '../../lib/format';

export function OrgSheet({
  id,
  onClose,
}: {
  id: Id<'organizations'> | undefined;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {id && (
          <ErrorBoundary title="Couldn't load this organization">
            <OrgSheetBody id={id} />
          </ErrorBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}

function OrgSheetBody({ id }: { id: Id<'organizations'> }) {
  const org = useQuery(api.admin.organizations.get, { id });

  if (org === undefined) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <SheetTitle className="sr-only">Loading organization</SheetTitle>
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (org === null) {
    return (
      <>
        <SheetTitle className="sr-only">Organization not found</SheetTitle>
        <EmptyState icon={IconBuildingOff} title="Organization not found" className="py-24" />
      </>
    );
  }

  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b p-6 pr-12">
        <UserAvatar name={org.name} imageUrl={org.imageUrl} square className="size-12" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="truncate text-lg">{org.name}</SheetTitle>
          <SheetDescription className="font-mono text-xs">/{org.slug}</SheetDescription>
        </div>
      </SheetHeader>

      <Tabs defaultValue="members" className="flex-1 gap-0">
        <TabsList variant="line" className="w-full justify-start border-b px-4">
          <TabsTrigger value="members">
            Members <span className="text-muted-foreground">{org.members.length}</span>
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents <span className="text-muted-foreground">{org.docCount}</span>
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="flex flex-col gap-3 p-6">
          <Callout>
            Membership is managed in the sign-in provider and mirrored here by members, so it is
            read-only.
          </Callout>
          <ul className="-mx-2 flex flex-col">
            {org.members.map((member) => (
              <li key={member.clerkId}>
                {member.user ? (
                  <Link
                    href={`/users?open=${member.user._id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <UserCell
                        name={member.user.name || member.user.email}
                        secondary={member.user.email}
                        imageUrl={member.user.imageUrl}
                      />
                    </div>
                    {member.isOwner ? (
                      <StatusBadge status="owner" />
                    ) : (
                      member.isOrgAdmin && <StatusBadge status="org-admin" />
                    )}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2 text-sm text-muted-foreground">
                    <span className="flex-1 truncate font-mono text-xs">{member.clerkId}</span>
                    <span className="text-xs">No profile yet</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="documents" className="flex flex-col gap-2 p-6">
          {org.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No documents in this organization.
            </p>
          ) : (
            <>
              <ul className="-mx-2 flex flex-col">
                {org.documents.map((doc) => (
                  <li key={doc._id}>
                    <Link
                      href={`/documents?open=${doc._id}`}
                      className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="flex-1 truncate text-sm font-medium">{doc.title}</span>
                      <StatusBadge status={doc.status ? 'active' : 'draft'} />
                      <RelativeTime
                        timestamp={doc.updatedAt}
                        className="w-24 shrink-0 text-right text-xs text-muted-foreground"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
              {org.docCount > org.documents.length && (
                <Link
                  href={`/documents?org=${org.clerkOrgId}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all {org.docCount} documents
                </Link>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="details" className="p-6">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Clerk org ID</dt>
            <dd className="flex items-center font-mono text-xs">
              <span className="truncate">{org.clerkOrgId}</span>
              <CopyButton value={org.clerkOrgId} label="Copy organization ID" />
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatDate(org.createdAt)}</dd>
            <dt className="text-muted-foreground">Last synced</dt>
            <dd>
              <RelativeTime timestamp={org.updatedAt} />
            </dd>
            <dt className="text-muted-foreground">Admins</dt>
            <dd>{org.admins.length}</dd>
          </dl>
        </TabsContent>
      </Tabs>
    </>
  );
}
