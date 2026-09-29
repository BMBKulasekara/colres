'use client';

import { ErrorState } from '../../components/feedback/error-state';
import { PageBody } from '../../components/page-header';

export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <PageBody>
      <div className="rounded-xl border bg-card">
        <ErrorState error={error} title="This page couldn't load" onRetry={reset} />
      </div>
    </PageBody>
  );
}
