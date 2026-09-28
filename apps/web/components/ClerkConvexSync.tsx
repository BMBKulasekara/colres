'use client';

import { useOrganization, useOrganizationList, useUser } from '@clerk/nextjs';
import { api } from '@repo/convex/_generated/api';
import type { ConvexReactClient } from 'convex/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Mirrors the signed-in Clerk user, their organisation memberships and their
 * active organisation into Convex.
 *
 * The three writes look independent and are not. Each one is the precondition
 * for the next:
 *
 *   users.upsert                -> creates the row the others patch
 *   users.syncUserOrganizations -> sets orgIds, which is what proves membership
 *   organizations.upsert…       -> refuses unless orgIds already names the org
 *
 * Clerk's three hooks resolve in whatever order the network returns them, so
 * firing a mutation from each hook's own effect means the order is decided by
 * timing. When `useOrganization` wins the race the organisation write arrives
 * before the membership that authorises it, and the server correctly refuses
 * it with "you are not a member of that organization" — an error that looks
 * like a permissions bug and is really a sequencing one. On a first sign-in
 * the same race also beats `users.upsert`, and the later two fail with
 * "User not found".
 *
 * So the writes are chained on promises rather than merely ordered in the
 * source. The effects still fire whenever Clerk is ready; what changed is that
 * each awaits the one it depends on.
 */
function ClerkConvexSyncContent({ convex }: { convex: ConvexReactClient }) {
  const { isLoaded, isSignedIn, user } = useUser();

  /** Resolves once the profile row exists. Everything else waits on it. */
  const profileSynced = useRef<Promise<unknown>>(Promise.resolve());
  /** Resolves once this user's orgIds are the ones Convex holds. */
  const orgIdsSynced = useRef<Promise<unknown>>(Promise.resolve());

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

    // The Clerk id and the role are no longer sent: Convex reads the id from
    // the verified token, and accepting a role from the client meant anyone
    // could make themselves an admin.
    profileSynced.current = convex
      .mutation(api.users.upsert, {
        name: user.fullName ?? (computedName || 'Anonymous'),
        email: user.primaryEmailAddress?.emailAddress ?? '',
        imageUrl: user.imageUrl ?? '',
      })
      .catch((error) => {
        // Retried on the next sign-in or reload rather than left half-done.
        syncedRef.current = null;
        console.error('Failed to sync the Clerk profile into Convex:', error);
      });
  }, [convex, isLoaded, isSignedIn, user]);

  // Sync user's list of organizations
  const { isLoaded: listLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
      keepPreviousData: true,
    },
  });

  const userOrgIds = userMemberships.data?.map((m) => m.organization.id) ?? [];
  const lastSyncUserOrgIdsRef = useRef<string>('');

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !listLoaded || !userMemberships.data) {
      return;
    }

    const orgIds = userMemberships.data.map((m) => m.organization.id);
    const orgIdsStr = [...orgIds].sort().join(',');

    if (lastSyncUserOrgIdsRef.current === orgIdsStr) {
      return;
    }

    lastSyncUserOrgIdsRef.current = orgIdsStr;

    orgIdsSynced.current = profileSynced.current
      .then(() => convex.mutation(api.users.syncUserOrganizations, { orgIds }))
      .catch((error) => {
        lastSyncUserOrgIdsRef.current = '';
        console.error('Failed to sync organization memberships into Convex:', error);
      });
  }, [convex, isLoaded, isSignedIn, user, listLoaded, userMemberships.data]);

  // Sync active organization data and membership information
  const { organization, memberships } = useOrganization({
    memberships: {
      keepPreviousData: true,
    },
  });

  const lastSyncActiveOrgDataRef = useRef<string>('');

  // Membership as Clerk reports it, which is what the server will check
  // against once `orgIdsSynced` has landed.
  const isMemberOfActiveOrg = organization ? userOrgIds.includes(organization.id) : false;

  useEffect(() => {
    if (!organization || !memberships || memberships.isLoading || !memberships.data) {
      return;
    }

    // The organisation write is refused unless Convex already knows this user
    // belongs to the org. Waiting for the membership list to say so — and, via
    // the promise below, for that to have been written — is what turns the
    // former race into a sequence.
    if (!listLoaded) {
      return;
    }

    if (!isMemberOfActiveOrg) {
      // An active organisation that is missing from the membership list means
      // the list is incomplete, not that the membership is: `useOrganizationList`
      // is paginated, so a user in many organisations may have the active one
      // on a page that was never fetched. Skipping the write is right — the
      // server would refuse it, and `orgIds` is missing the same entry — but it
      // is worth saying so, because the symptom is an organisation that quietly
      // never appears in Convex.
      console.warn(
        `Active organization ${organization.id} is not in the loaded membership list, ` +
          'so it was not synced. It is probably on an unfetched page of useOrganizationList.'
      );
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

    void orgIdsSynced.current
      .then(() =>
        convex.mutation(api.organizations.upsertOrganization, {
          clerkOrgId: orgId,
          name: organization.name,
          slug: organization.slug || '',
          imageUrl: organization.imageUrl || undefined,
          ownerId: owner,
          admins,
          members,
        })
      )
      .catch((error) => {
        lastSyncActiveOrgDataRef.current = '';
        console.error('Failed to sync the active organization into Convex:', error);
      });
  }, [convex, organization, memberships, listLoaded, isMemberOfActiveOrg]);

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
