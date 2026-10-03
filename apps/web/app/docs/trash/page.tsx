'use client';

import { useOrganization } from '@clerk/nextjs';
import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { TrashList } from '../../../components/trash/TrashList';

/** The recycle bin of the workspace chosen in the organization switcher. */
export default function TrashPage() {
  const { organization, isLoaded } = useOrganization();

  return (
    <div className="min-h-dvh w-full px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header className="flex items-start gap-2">
          <SidebarTrigger className="-ml-1 mt-0.5 md:hidden" aria-label="Open navigation" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bin</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {organization
                ? `Deleted documents in ${organization.name}`
                : 'Your deleted documents'}
            </p>
          </div>
        </header>

        {/* Waits for Clerk, or the personal bin would flash before the org's. */}
        {isLoaded && <TrashList key={organization?.id ?? 'personal'} orgId={organization?.id} />}
      </div>
    </div>
  );
}
