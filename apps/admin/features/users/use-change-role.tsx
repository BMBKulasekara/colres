'use client';

import { api } from '@repo/convex/_generated/api';
import type { Id } from '@repo/convex/_generated/dataModel';
import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { useConfirm } from '../../components/feedback/confirm-dialog';
import { errorMessage } from '../../lib/convex-error';
import type { Role } from './types';

/**
 * Role changes with the consequence spelled out first, and an Undo on the
 * toast. The server refuses self-demotion and removing the last admin.
 */
export function useChangeRole() {
  const confirm = useConfirm();
  const setRole = useMutation(api.admin.users.setRole);

  return async (
    user: { _id: Id<'users'>; name: string; email: string; role: string },
    role: Role
  ) => {
    if (user.role === role) return false;
    const name = user.name || user.email;
    const promoting = role === 'admin';

    const ok = await confirm({
      title: promoting ? `Make ${name} an admin?` : `Remove ${name}'s admin role?`,
      description: promoting
        ? 'Admins can see and change every document, template and user, including other admins.'
        : 'They lose access to this console on their next request. Their documents are not affected.',
      confirmText: promoting ? 'Make admin' : 'Remove admin role',
      destructive: !promoting,
    });
    if (!ok) return false;

    try {
      await setRole({ userId: user._id, role });
      toast.success(promoting ? `${name} is now an admin` : `${name} is no longer an admin`, {
        action: {
          label: 'Undo',
          onClick: () => {
            setRole({ userId: user._id, role: promoting ? 'user' : 'admin' }).catch(
              (error: unknown) => toast.error(errorMessage(error))
            );
          },
        },
      });
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    }
  };
}
