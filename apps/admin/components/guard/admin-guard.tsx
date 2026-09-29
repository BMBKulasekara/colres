'use client';

import { useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { CurrentAdminContext } from '../../hooks/use-current-admin';
import { AccessDenied } from './access-denied';
import { GuardLoading } from './guard-loading';
import { SignInScreen } from './sign-in-screen';

/**
 * Gates the console on a signed-in Clerk user whose Convex row has the admin
 * role. This is a UX layer only: every admin Convex function checks the role
 * itself, so bypassing this component grants nothing.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const upsertUser = useMutation(api.users.upsert);
  const syncedRef = useRef<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Mirror the Clerk profile into Convex once per sign-in, so a brand new
  // account has a row for the role check to find.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const userKey = `${user.id}:${user.primaryEmailAddress?.emailAddress ?? ''}`;
    if (syncedRef.current === userKey) return;
    syncedRef.current = userKey;

    const computedName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    setIsSyncing(true);
    upsertUser({
      name: user.fullName ?? (computedName || 'Anonymous'),
      email: user.primaryEmailAddress?.emailAddress ?? '',
      imageUrl: user.imageUrl ?? '',
    })
      .catch((error: unknown) => console.error('Failed to sync user to Convex:', error))
      .finally(() => setIsSyncing(false));
  }, [isLoaded, isSignedIn, user, upsertUser]);

  const convexUser = useQuery(
    api.users.getByClerkId,
    isSignedIn && user ? { clerkId: user.id } : 'skip'
  );

  if (!isLoaded || isSyncing || (isSignedIn && convexUser === undefined)) {
    return <GuardLoading />;
  }
  if (!isSignedIn) {
    return <SignInScreen />;
  }
  if (!convexUser || convexUser.role !== 'admin') {
    return <AccessDenied email={user.primaryEmailAddress?.emailAddress} />;
  }

  return <CurrentAdminContext.Provider value={convexUser}>{children}</CurrentAdminContext.Provider>;
}
