'use client';

import { useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { useEffect, useRef, useState } from 'react';

function ClerkConvexSyncContent({ convex }: { convex: ConvexReactClient }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    const userKey = `${user.id}:${user.primaryEmailAddress?.emailAddress ?? ''}`;
    if (syncedRef.current === userKey) {
      return;
    }

    syncedRef.current = userKey;

    const computedName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();

    void convex.mutation(api.users.upsert, {
      clerkId: user.id,
      name: user.fullName ?? (computedName || 'Anonymous'),
      email: user.primaryEmailAddress?.emailAddress ?? '',
      imageUrl: user.imageUrl ?? '',
    });
  }, [convex, isLoaded, isSignedIn, user]);

  return null;
}

export function ClerkConvexSync({ convex }: { convex: ConvexReactClient }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <ClerkConvexSyncContent convex={convex} />;
}
