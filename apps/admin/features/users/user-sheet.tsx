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
import { cn } from '@repo/ui/lib/utils';
import { IconCrown, IconTrash, IconUser, IconUserOff } from '@tabler/icons-react';
import { useQuery } from 'convex/react';
import Link from 'next/link';
import { useState } from 'react';
import { CopyButton } from '../../components/feedback/copy-button';
import { EmptyState } from '../../components/feedback/empty-state';
import { ErrorBoundary } from '../../components/feedback/error-state';
import { StatusBadge } from '../../components/feedback/status-badge';
import { Callout } from '../../components/form-field';
import { RelativeTime } from '../../components/relative-time';
import { UserAvatar } from '../../components/user-avatar';
import { useCurrentAdmin } from '../../hooks/use-current-admin';
import { formatDate } from '../../lib/format';
import { ActivityFeed } from '../activity/activity-feed';
import { DeleteUserDialog } from './delete-user-dialog';
import type { Role, UserDetail } from './types';
import { useChangeRole } from './use-change-role';

export function UserSheet({ id, onClose }: { id: Id<'users'> | undefined; onClose: () => void }) {
  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {id && (
          <ErrorBoundary title="Couldn't load this user">
            <UserSheetBody id={id} onClose={onClose} />
          </ErrorBoundary>
        )}
      </SheetContent>
    </Sheet>
  );
}

function UserSheetBody({ id, onClose }: { id: Id<'users'>; onClose: () => void }) {
  const user = useQuery(api.admin.users.get, { id });
  const admin = useCurrentAdmin();
  const [deleting, setDeleting] = useState(false);

  if (user === undefined) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <SheetTitle className="sr-only">Loading user</SheetTitle>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (user === null) {
    return (
      <>
        <SheetTitle className="sr-only">User not found</SheetTitle>
        <EmptyState
          icon={IconUserOff}
          title="User not found"
          description="They may have been deleted."
          className="py-24"
        />
      </>
    );
  }

  const isSelf = user._id === admin._id;

  return (
    <>
      <SheetHeader className="flex-row items-center gap-3 border-b p-6 pr-12">
        <UserAvatar name={user.name} imageUrl={user.imageUrl} className="size-12" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <SheetTitle className="flex items-center gap-2 truncate text-lg">
            {user.name || user.email}
            {isSelf && (
              <span className="rounded bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                you
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="flex items-center truncate">
            {user.email}
            <CopyButton value={user.email} label="Copy email" />
          </SheetDescription>
        </div>
      </SheetHeader>

      <Tabs defaultValue="profile" className="flex-1 gap-0">
        <TabsList variant="line" className="w-full justify-start border-b px-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">
            Documents{' '}
            {user.docCount > 0 && <span className="text-muted-foreground">{user.docCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="orgs">
            Orgs{' '}
            {user.organizations.length > 0 && (
              <span className="text-muted-foreground">{user.organizations.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-6 p-6">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Clerk ID</dt>
            <dd className="flex items-center font-mono text-xs">
              <span className="truncate">{user.clerkId}</span>
              <CopyButton value={user.clerkId} label="Copy Clerk ID" />
            </dd>
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <StatusBadge status={user.role === 'admin' ? 'admin' : 'user'} />
            </dd>
          </dl>
          <Callout>
            Name, email and avatar come from the user&apos;s sign-in account and update when they
            next sign in.
          </Callout>

          <RoleControl user={user} isSelf={isSelf} />

          {!isSelf && (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 p-4">
              <div>
                <h3 className="text-sm font-medium text-destructive">Delete user</h3>
                <p className="text-xs text-muted-foreground">
                  Deletes their sign-in account and profile. You choose what happens to their
                  documents.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <IconTrash size={15} aria-hidden="true" />
                Delete user…
              </Button>
              {deleting && (
                <DeleteUserDialog
                  user={user}
                  open={deleting}
                  onOpenChange={setDeleting}
                  onDeleted={onClose}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="flex flex-col gap-2 p-6">
          {user.documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No documents.</p>
          ) : (
            <>
              <ul className="-mx-2 flex flex-col">
                {user.documents.map((doc) => (
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
              {user.docCount > user.documents.length && (
                <Link
                  href={`/documents?author=${user._id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View all {user.docCount} documents
                </Link>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="orgs" className="p-6">
          {user.organizations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Not a member of any organization.
            </p>
          ) : (
            <ul className="-mx-2 flex flex-col">
              {user.organizations.map((org) => (
                <li key={org._id}>
                  <Link
                    href={`/organizations?open=${org._id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <UserAvatar name={org.name} imageUrl={org.imageUrl} square />
                    <span className="flex-1 truncate text-sm font-medium">{org.name}</span>
                    {org.isOrgAdmin && <StatusBadge status="org-admin" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="activity" className="p-6">
          <ActivityFeed
            compact
            filters={{ entityType: 'user', entityId: user._id }}
            pageSize={20}
            emptyHint="No admin changes to this user yet."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function RoleControl({ user, isSelf }: { user: UserDetail; isSelf: boolean }) {
  const changeRole = useChangeRole();
  const [pending, setPending] = useState<Role | null>(null);

  const options: { value: Role; label: string; hint: string; icon: typeof IconCrown }[] = [
    { value: 'user', label: 'User', hint: 'Uses the Colres app', icon: IconUser },
    { value: 'admin', label: 'Admin', hint: 'Full console access', icon: IconCrown },
  ];

  return (
    <fieldset className="flex flex-col gap-2" disabled={isSelf || pending !== null}>
      <legend className="mb-1 text-sm font-medium">Role</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = user.role === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={async () => {
                if (active) return;
                setPending(option.value);
                await changeRole(user, option.value);
                setPending(null);
              }}
              className={cn(
                'flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60',
                active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <option.icon
                size={18}
                className={active ? 'text-primary' : 'text-muted-foreground'}
                aria-hidden="true"
              />
              <span className="flex flex-col">
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {isSelf && (
        <p className="text-xs text-muted-foreground">You can&apos;t change your own role.</p>
      )}
    </fieldset>
  );
}
