import { auth } from '@clerk/nextjs/server';
import { ConvexHttpClient } from 'convex/browser';

/**
 * A Convex client authenticated as the signed-in admin.
 *
 * Convex functions now verify the caller themselves, so the server-side client
 * has to forward the Clerk JWT rather than calling anonymously. The token comes
 * from the "convex" JWT template configured in the Clerk dashboard; without it
 * every call fails as unauthenticated.
 *
 * The route-level role check stays as well: it fails fast with a clean 403
 * instead of surfacing a Convex exception, and keeps the HTTP layer honest
 * independently of what the backend enforces.
 */
export async function getAdminConvexClient(): Promise<
  { error: string; status: number } | { convex: ConvexHttpClient; userId: string }
> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return { error: 'NEXT_PUBLIC_CONVEX_URL is not defined', status: 500 };
  }

  const { userId, getToken } = await auth();
  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = await getToken({ template: 'convex' });
  if (!token) {
    return {
      error:
        'Could not mint a Convex token. Check that a JWT template named "convex" exists in Clerk.',
      status: 401,
    };
  }

  const convex = new ConvexHttpClient(url);
  convex.setAuth(token);

  return { convex, userId };
}
