import type { Id } from '@repo/convex/_generated/dataModel';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TemplateEditor } from '../../../../features/templates/editor/template-editor';

export const metadata: Metadata = { title: 'Edit template' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <TemplateEditor id={id as Id<'templates'>} />
    </Suspense>
  );
}
