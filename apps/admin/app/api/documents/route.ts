import { auth } from '@clerk/nextjs/server';
import { api } from '@repo/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not defined');
  return new ConvexHttpClient(url);
}

async function verifyAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return { error: 'Unauthorized', status: 401 };
  }

  const convex = getConvexClient();
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

export async function POST(request: Request) {
  try {
    const authResult = await verifyAdmin();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { convex, userId } = authResult;
    const { title, slug, content, status, orgId } = await request.json();

    if (!title || !slug) {
      return NextResponse.json({ error: 'Title and Slug are required' }, { status: 400 });
    }

    const newDoc = await convex.mutation(api.documents.createDocument, {
      title,
      slug,
      content: content ?? '',
      status: !!status,
      clerkId: userId,
      orgId,
    });

    return NextResponse.json(newDoc);
  } catch (error: any) {
    console.error('Error creating document:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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

    const updatedDoc = await convex.mutation(api.documents.updateDocument, {
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

    const deletedDoc = await convex.mutation(api.documents.deleteDocumentById, {
      id: id as any,
    });

    return NextResponse.json(deletedDoc);
  } catch (error: any) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
