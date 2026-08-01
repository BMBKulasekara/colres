'use client';

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { useEffect, useRef, useState } from 'react';

function ClerkConvexSyncContent({ convex }: { convex: ConvexReactClient }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const syncedRef = useRef<string | null>(null);

  // Sync user details to Convex
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
      role: 'user',
    });
  }, [convex, isLoaded, isSignedIn, user]);

  // Sync user's list of organizations
  const { isLoaded: listLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
      keepPreviousData: true,
    },
  });

  const lastSyncUserOrgIdsRef = useRef<string>('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !listLoaded || !userMemberships.data) {
      return;
    }

    const userOrgIds = userMemberships.data.map((m) => m.organization.id);
    const orgIdsStr = [...userOrgIds].sort().join(',');

    if (lastSyncUserOrgIdsRef.current === orgIdsStr) {
      return;
    }

    lastSyncUserOrgIdsRef.current = orgIdsStr;

    void convex.mutation(api.users.syncUserOrganizations, {
      clerkId: user.id,
      orgIds: userOrgIds,
    });
  }, [convex, isLoaded, isSignedIn, user, listLoaded, userMemberships.data]);

  // Sync active organization data and membership information
  const { organization, memberships } = useOrganization({
    memberships: {
      keepPreviousData: true,
    },
  });

  const lastSyncActiveOrgDataRef = useRef<string>('');

  useEffect(() => {
    if (!organization || !memberships || memberships.isLoading || !memberships.data) {
      return;
    }

    const orgId = organization.id;
    const members = memberships.data
      .map((m) => m.publicUserData?.userId)
      .filter(Boolean) as string[];

    const admins = memberships.data
      .filter(
        (m) =>
          m.role === 'org:admin' ||
          m.role === 'org:owner' ||
          m.role === 'admin' ||
          m.role === 'owner'
      )
      .map((m) => m.publicUserData?.userId)
      .filter(Boolean) as string[];

    const owner =
      memberships.data.find((m) => m.role === 'org:owner' || m.role === 'owner')?.publicUserData
        ?.userId ?? '';

    // Create a key based on org data to check for updates
    const dataKey = `${organization.name}:${organization.slug || ''}:${organization.imageUrl}:${owner}:${admins.sort().join(',')}:${members.sort().join(',')}`;

    if (lastSyncActiveOrgDataRef.current === dataKey) {
      return;
    }

    lastSyncActiveOrgDataRef.current = dataKey;

    void convex.mutation(api.organizations.upsertOrganization, {
      clerkOrgId: orgId,
      name: organization.name,
      slug: organization.slug || '',
      imageUrl: organization.imageUrl || undefined,
      ownerId: owner,
      admins,
      members,
    });
  }, [convex, organization, memberships]);

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
