import type { api } from '@repo/convex/_generated/api';
import type { FunctionReturnType } from 'convex/server';

export type UserRow = FunctionReturnType<typeof api.admin.users.list>['page'][number];
export type UserDetail = NonNullable<FunctionReturnType<typeof api.admin.users.get>>;
export type Role = 'admin' | 'user';
