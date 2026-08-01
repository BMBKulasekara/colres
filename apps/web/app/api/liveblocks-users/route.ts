import { api } from '@repo/convex/_generated/api';
import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

const COLORS = [
  '#e11d48',
  '#db2777',
  '#c026d3',
  '#9333ea',
  '#7c3aed',
  '#2563eb',
  '#0284c7',
  '#0d9488',
  '#059669',
  '#16a34a',
  '#ea580c',
  '#dc2626',
];

function getRandomColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

export async function POST(request: Request) {
  try {
    const { userIds } = await request.json();
    if (!userIds || !Array.isArray(userIds)) {
      return NextResponse.json({ error: 'Invalid userIds' }, { status: 400 });
    }

    const users = await Promise.all(
      userIds.map(async (clerkId) => {
        try {
          const user = await convex.query(api.users.getByClerkId, { clerkId });
          if (user) {
            return {
              id: clerkId,
              name: user.name,
              avatar: user.imageUrl,
              color: getRandomColor(clerkId),
            };
          }
        } catch (err) {
          console.error(`Failed to fetch user ${clerkId}:`, err);
        }
        return {
          id: clerkId,
          name: 'Anonymous',
          avatar: '',
          color: getRandomColor(clerkId),
        };
      })
    );

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error in liveblocks-users API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
