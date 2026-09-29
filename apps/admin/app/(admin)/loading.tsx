import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { PageBody } from '../../components/page-header';

export default function Loading() {
  return (
    <PageBody>
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-96 w-full" />
    </PageBody>
  );
}
