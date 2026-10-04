'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { ROLE_LABELS, SHARED_ROLES, type SharedRole } from '@repo/convex/sharing/roles';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, Share2, UserMinus } from 'lucide-react';
import Image from 'next/image';
import { type FormEvent, useState } from 'react';

/** Turns a Convex error into the sentence it carries. */
function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const match = text.match(/(?:Uncaught Error: |Error: )([^\n]+)/);
  return (match?.[1] ?? text).replace(/^Forbidden: /, '').trim();
}

function RoleSelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: SharedRole;
  onChange: (role: SharedRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SharedRole)} disabled={disabled}>
      <SelectTrigger size="sm" className="w-32 shrink-0" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHARED_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * The Share button and dialog: who else can open this document, and at what
 * level. Everyone with access sees the list; only the author and organization
 * members (`canManage`) can change it.
 */
export function ShareButton({
  documentId,
  canManage,
}: {
  documentId: Id<'documents'>;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 aria-hidden="true" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share this document</DialogTitle>
            <DialogDescription>
              Everyone in this document&rsquo;s workspace already has full access. Invite people
              from outside it here.
            </DialogDescription>
          </DialogHeader>
          {open && <ShareBody documentId={documentId} canManage={canManage} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareBody({ documentId, canManage }: { documentId: Id<'documents'>; canManage: boolean }) {
  const members = useQuery(api.sharing.listMembers, { documentId });
  const invite = useMutation(api.sharing.invite);
  const setRole = useMutation(api.sharing.setRole);
  const remove = useMutation(api.sharing.remove);

  const [email, setEmail] = useState('');
  const [role, setNewRole] = useState<SharedRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    await run(async () => {
      await invite({ documentId, email, role });
      setEmail('');
    });
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@university.edu"
            aria-label="Email address to invite"
            className="h-8"
          />
          <RoleSelect value={role} onChange={setNewRole} label="Role for the new person" />
          <Button type="submit" size="sm" disabled={busy || !email.trim()}>
            {busy ? <Loader2 className="animate-spin" /> : 'Invite'}
          </Button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {members === undefined ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Not shared with anyone outside the workspace.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member._id} className="flex items-center gap-3">
              {member.imageUrl ? (
                <Image
                  src={member.imageUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 shrink-0 rounded-full"
                />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                  {member.email[0]}
                </span>
              )}
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium">{member.name ?? member.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {member.name ? member.email : 'Invited · no account yet'}
                </span>
              </span>
              {canManage ? (
                <>
                  <RoleSelect
                    value={member.role}
                    onChange={(next) => run(() => setRole({ memberId: member._id, role: next }))}
                    label={`Role for ${member.email}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${member.email}`}
                    onClick={() => run(() => remove({ memberId: member._id }))}
                  >
                    <UserMinus />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        People sign in with the invited email to get access; Colres does not send the invite for you
        yet, so send them this page&rsquo;s link. Editors can change the text, commenters can
        comment and use team chat, viewers can only read.
      </p>
    </div>
  );
}
