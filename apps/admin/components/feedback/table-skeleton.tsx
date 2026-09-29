import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { TableBody, TableCell, TableRow } from '@repo/ui/components/ui/table';
import { placeholderKeys } from '../../lib/placeholders';

/** Rows shaped like the real table, so nothing shifts when data arrives. */
export function TableSkeletonRows({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <TableBody aria-busy="true">
      {placeholderKeys(rows, 'row').map((row) => (
        <TableRow key={row} className="hover:bg-transparent">
          {placeholderKeys(columns, 'col').map((col) => (
            <TableCell key={col} className="py-3">
              <Skeleton className={col === 'col-0' ? 'h-4 w-3/4' : 'h-4 w-1/2'} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}
