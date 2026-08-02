import { api } from '@repo/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!url) return null;
  return new ConvexHttpClient(url);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || '';

    const convex = getConvexClient();
    if (!convex) {
      console.error('Missing Convex deployment URL (NEXT_PUBLIC_CONVEX_URL or CONVEX_URL).');
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const allUsers = await convex.query(api.users.getAllUsers);

    const filteredUserIds = allUsers
      .filter(
        (u) =>
          u.name.toLowerCase().includes(text.toLowerCase()) ||
          u.email.toLowerCase().includes(text.toLowerCase())
      )
      .map((u) => u.clerkId);

    return NextResponse.json(filteredUserIds);
  } catch (error) {
    console.error('Error in liveblocks-users search API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
