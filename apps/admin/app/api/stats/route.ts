import { api } from '@repo/convex/_generated/api';
import { NextResponse } from 'next/server';
import { getAdminConvexClient } from '../../../lib/convexServer';

async function verifyAdmin() {
  const result = await getAdminConvexClient();
  if ('error' in result) return result;

  const { convex, userId } = result;
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user || user.role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }

  return { convex };
}

export async function GET() {
  try {
    const authResult = await verifyAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { convex } = authResult;

    // Run queries concurrently for fast response times
    const [users, organizations, documents] = await Promise.all([
      convex.query(api.users.getAllUsers),
      convex.query(api.organizations.getAllOrganizations),
      convex.query(api.documents.getAllDocuments),
    ]);

    return NextResponse.json({
      users: users.length,
      organizations: organizations.length,
      documents: documents.length,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
