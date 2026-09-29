import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TemplatesView } from '../../../features/templates/templates-view';

export const metadata: Metadata = { title: 'Templates' };

export default function Page() {
  return (
    <Suspense>
      <TemplatesView />
    </Suspense>
  );
}
