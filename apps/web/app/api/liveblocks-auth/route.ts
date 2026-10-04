import { auth, currentUser } from '@clerk/nextjs/server';
import { Liveblocks } from '@liveblocks/node';
import { api } from '@repo/convex/_generated/api';
import { type DocumentRole, roleAllows } from '@repo/convex/sharing/roles';
import { ConvexHttpClient } from 'convex/browser';

/** The permission list `session.allow` takes; the type itself is not exported. */
type RoomPermissions = Parameters<ReturnType<Liveblocks['prepareSession']>['allow']>[1];

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

/**
 * What each document role may do in its Liveblocks room: editors write the
 * text, commenters read it and write comments, viewers only read.
 */
function roomPermissions(role: DocumentRole): RoomPermissions {
  if (roleAllows(role, 'edit')) return ['*:write'];
  if (roleAllows(role, 'comment')) return ['*:read', 'comments:write'];
  return ['*:read'];
}

/**
 * Issues a Liveblocks access token for one document's room.
 *
 * The room is the document id, and access to it is decided by Convex, the
 * same rule as every other read and write of the document: no role, no
 * token. The token carries only that room, at that role's level.
 */
export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { room } = await request.json();
    if (!room || typeof room !== 'string') {
      return new Response('Missing room ID', { status: 400 });
    }

    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret || !secret.startsWith('sk_')) {
      console.error(
        'Missing or invalid LIVEBLOCKS_SECRET_KEY; expected a Liveblocks secret starting with "sk_"'
      );
      return new Response('Liveblocks secret not configured', { status: 500 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
    if (!convexUrl) {
      console.error('Missing Convex deployment URL (NEXT_PUBLIC_CONVEX_URL or CONVEX_URL).');
      return new Response('Service unavailable', { status: 503 });
    }

    // Ask Convex as this user, with the same Clerk token the browser uses.
    const { getToken } = await auth();
    const token = await getToken({ template: 'convex' });
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }
    const convex = new ConvexHttpClient(convexUrl);
    convex.setAuth(token);
    const role = await convex.query(api.sharing.roomAccess, { room });
    if (!role) {
      return new Response('Forbidden', { status: 403 });
    }

    const liveblocks = new Liveblocks({ secret });

    // Ensure the room exists on Liveblocks. Create it if it doesn't. It is
    // created with no default access: everything goes through tokens.
    try {
      await liveblocks.getRoom(room);
    } catch (error: any) {
      if (error.status === 404) {
        try {
          await liveblocks.createRoom(room, { defaultAccesses: [] });
        } catch (createError) {
          console.error('Failed to create room in Liveblocks:', createError);
        }
      } else {
        console.error('Failed to check room in Liveblocks:', error);
      }
    }

    const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Anonymous';

    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        name: fullName,
        avatar: user.imageUrl || '',
        color: getRandomColor(user.id),
      },
    });
    session.allow(room, roomPermissions(role));
    const { status, body } = await session.authorize();

    return new Response(body, { status });
  } catch (error) {
    console.error('Error in Liveblocks auth endpoint:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
