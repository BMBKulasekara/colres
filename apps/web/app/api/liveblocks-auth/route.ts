import { currentUser } from '@clerk/nextjs/server';
import { Liveblocks } from '@liveblocks/node';

const COLORS = [
  '#e11d48', // rose
  '#db2777', // pink
  '#c026d3', // fuchsia
  '#9333ea', // purple
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0284c7', // sky
  '#0d9488', // teal
  '#059669', // emerald
  '#16a34a', // green
  '#ea580c', // orange
  '#dc2626', // red
];

function getRandomColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index] || '#e11d48';
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { room } = await request.json();
    if (!room) {
      return new Response('Missing room ID', { status: 400 });
    }

    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret || !secret.startsWith('sk_')) {
      console.error(
        'Missing or invalid LIVEBLOCKS_SECRET_KEY; expected a Liveblocks secret starting with "sk_"'
      );
      return new Response('Liveblocks secret not configured', { status: 500 });
    }

    const liveblocks = new Liveblocks({ secret });

    // Ensure the room exists on Liveblocks. Create it if it doesn't.
    try {
      await liveblocks.getRoom(room);
    } catch (error: any) {
      if (error.status === 404) {
        try {
          await liveblocks.createRoom(room, {
            defaultAccesses: ['room:write'],
          });
        } catch (createError) {
          console.error('Failed to create room in Liveblocks:', createError);
        }
      } else {
        console.error('Failed to check room in Liveblocks:', error);
      }
    }

    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Anonymous';

    // Identify the user and return the result
    const { status, body } = await liveblocks.identifyUser(
      {
        userId: user.id,
        groupIds: [],
      },
      {
        userInfo: {
          name: fullName,
          avatar: user.imageUrl || '',
          color: getRandomColor(user.id),
        },
      }
    );

    return new Response(body, { status });
  } catch (error) {
    console.error('Error in Liveblocks auth endpoint:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
