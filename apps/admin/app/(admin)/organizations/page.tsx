import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrganizationsView } from '../../../features/organizations/organizations-view';

export const metadata: Metadata = { title: 'Organizations' };

export default function Page() {
  return (
    <Suspense>
      <OrganizationsView />
    </Suspense>
  );
}
