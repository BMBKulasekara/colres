'use client';

import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from '@liveblocks/react/suspense';
import type { ReactNode } from 'react';

export function Room({ roomId, children }: { roomId: string; children: ReactNode }) {
  return (
    <LiveblocksProvider
      authEndpoint="/api/liveblocks-auth"
      resolveUsers={async ({ userIds }) => {
        try {
          const response = await fetch('/api/liveblocks-users', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userIds }),
          });
          if (!response.ok) return [];
          return await response.json();
        } catch (error) {
          console.error('Failed to resolve users:', error);
          return [];
        }
      }}
      resolveMentionSuggestions={async ({ text }) => {
        try {
          const response = await fetch(
            `/api/liveblocks-users/search?text=${encodeURIComponent(text)}`
          );
          if (!response.ok) return [];
          return await response.json();
        } catch (error) {
          console.error('Failed to resolve mention suggestions:', error);
          return [];
        }
      }}
    >
      <RoomProvider id={roomId}>
        <ClientSideSuspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-muted/10">
              <div className="flex flex-col items-center gap-4">
                <span className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <span className="text-sm font-semibold text-muted-foreground animate-pulse">
                  Connecting to room...
                </span>
              </div>
            </div>
          }
        >
          {children}
        </ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  );
}
