'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import { IconAlertTriangle, IconLoader2 } from '@tabler/icons-react';
import { useAction, usePaginatedQuery } from 'convex/react';
import { useId, useState } from 'react';
import { UserCell } from '../../components/user-avatar';
import { useAsyncAction } from '../../hooks/use-async-action';
import { useDebouncedValue } from '../../hooks/use-debounced-value';
import { pluralize } from '../../lib/format';
import type { UserDetail } from './types';

type Policy = 'transfer' | 'delete';

/**
 * Deleting a user removes their Clerk account and Convex row. Their documents
 * either move to another user or are deleted with them; the admin picks which.
 */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onDeleted,
}: {
  user: UserDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const id = useId();
  const [policy, setPolicy] = useState<Policy>(user.docCount > 0 ? 'transfer' : 'delete');
  const [recipient, setRecipient] = useState<{ _id: Id<'users'>; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');
  const debounced = useDebouncedValue(search.trim(), 250);
  const remove = useAction(api.admin.users.remove);

  const { results: candidates } = usePaginatedQuery(
    api.admin.users.list,
    open && policy === 'transfer' ? { q: debounced || undefined } : 'skip',
    { initialNumItems: 6 }
  );

  const { run, pending } = useAsyncAction(
    () =>
      remove({
        userId: user._id,
        documents: policy,
        transferTo: policy === 'transfer' ? recipient?._id : undefined,
      }),
    { success: `Deleted ${user.name || user.email}`, error: "Couldn't delete the user" }
  );

  const needsRecipient = user.docCount > 0 && policy === 'transfer' && !recipient;
  const canDelete = typed.trim() === user.email && !needsRecipient && !pending;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!canDelete) return;
            const result = await run();
            if (result) onDeleted();
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle size={20} className="text-destructive" aria-hidden="true" />
              Delete {user.name || user.email}?
            </DialogTitle>
            <DialogDescription>
              Deletes their sign-in account and profile. They are removed from{' '}
              {pluralize(user.organizations.length, 'organization')}. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {user.docCount > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                What happens to their {pluralize(user.docCount, 'document')}?
              </legend>
              {(
                [
                  {
                    value: 'transfer',
                    label: 'Transfer to another user',
                    hint: 'Documents, chats and comments are kept.',
                  },
                  {
                    value: 'delete',
                    label: 'Delete them',
                    hint: 'Removes the documents and everything linked to them.',
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
                    policy === option.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-policy`}
                    checked={policy === option.value}
                    onChange={() => setPolicy(option.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {user.docCount > 0 && policy === 'transfer' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-recipient`}>Transfer to</Label>
              <Input
                id={`${id}-recipient`}
                placeholder="Search by name or email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoComplete="off"
              />
              <fieldset className="flex max-h-44 flex-col overflow-y-auto rounded-md border">
                <legend className="sr-only">Recipient</legend>
                {candidates
                  .filter((c) => c._id !== user._id)
                  .map((candidate) => (
                    <label
                      key={candidate._id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-muted/60 has-[:focus-visible]:bg-muted',
                        recipient?._id === candidate._id && 'bg-primary/10'
                      )}
                    >
                      <input
                        type="radio"
                        name={`${id}-recipient-choice`}
                        className="accent-primary"
                        checked={recipient?._id === candidate._id}
                        onChange={() =>
                          setRecipient({
                            _id: candidate._id,
                            name: candidate.name || candidate.email,
                          })
                        }
                      />
                      <UserCell
                        name={candidate.name || candidate.email}
                        secondary={candidate.email}
                        imageUrl={candidate.imageUrl}
                      />
                    </label>
                  ))}
              </fieldset>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-confirm`} className="font-normal text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{user.email}</span> to
              confirm
            </Label>
            <Input
              id={`${id}-confirm`}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!canDelete}>
              {pending && <IconLoader2 size={15} className="animate-spin" aria-hidden="true" />}
              Delete user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
