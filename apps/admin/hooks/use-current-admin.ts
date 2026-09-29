'use client';

import type { Doc } from '@repo/convex/_generated/dataModel';
import { createContext, useContext } from 'react';

export const CurrentAdminContext = createContext<Doc<'users'> | null>(null);

/**
 * The signed-in admin's Convex row, verified by the guard. Only usable below
 * `AdminGuard`, which renders nothing else until this is known.
 */
export function useCurrentAdmin(): Doc<'users'> {
  const admin = useContext(CurrentAdminContext);
  if (!admin) {
    throw new Error('useCurrentAdmin must be used inside <AdminGuard>');
  }
  return admin;
}
