'use client';

import { useOthers, useSelf } from '@liveblocks/react/suspense';
import Image from 'next/image';

export function Collaborators() {
  const others = useOthers();
  const self = useSelf();

  const allCollaborators = [...(self ? [self] : []), ...others];

  return (
    <div className="flex items-center -space-x-1.5">
      {allCollaborators.map((user) => {
        const color = (user.info as any)?.color || '#ccc';
        const name = (user.info as any)?.name || 'Anonymous';
        const avatar = (user.info as any)?.avatar;

        return (
          <div
            key={user.connectionId}
            className="relative inline-block h-7 w-7 rounded-full transition-all duration-200 hover:scale-110 hover:z-10"
            style={{
              borderColor: color,
              borderStyle: 'solid',
              borderWidth: '2px',
              backgroundColor: '#fff',
            }}
            title={name}
          >
            {avatar ? (
              <Image
                src={avatar}
                alt={name}
                width={100}
                height={100}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="h-full w-full rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
