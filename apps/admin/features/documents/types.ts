import type { api } from '@repo/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

export type DocumentRow = FunctionReturnType<typeof api.admin.documents.list>['page'][number];
export type DocumentDetail = NonNullable<FunctionReturnType<typeof api.admin.documents.get>>;
