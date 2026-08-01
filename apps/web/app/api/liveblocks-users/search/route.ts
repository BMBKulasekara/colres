import { api } from '@repo/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get('text') || '';

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
