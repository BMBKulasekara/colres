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

  return { userId, convex };
}

export async function GET() {
  try {
    const authResult = await verifyAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { convex } = authResult;
    const documents = await convex.query(api.documents.getAllDocuments);
    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { convex } = authResult;
    const { id, title, slug, content, status } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Admins are not necessarily members of the owning organization, so this
    // uses the admin-scoped mutation rather than the collaborator one.
    const updatedDoc = await convex.mutation(api.documents.adminUpdateDocument, {
      id,
      title,
      slug,
      content,
      status,
    });

    return NextResponse.json(updatedDoc);
  } catch (error: any) {
    console.error('Error updating document:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { convex } = authResult;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const deletedDoc = await convex.mutation(api.documents.adminDeleteDocument, {
      id: id as any,
    });

    return NextResponse.json(deletedDoc);
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
