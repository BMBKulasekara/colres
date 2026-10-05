'use client';

import { api } from '@repo/convex/_generated/api';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { useMutation, useQuery } from 'convex/react';
import { AtSign, Bell, CalendarClock, MessageSquare, MessagesSquare, Share2 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '../lib/relativeTime';

const KIND = {
  mention: { icon: AtSign, verb: 'mentioned you in' },
  chat_reply: { icon: MessagesSquare, verb: 'replied to you in' },
  comment_reply: { icon: MessageSquare, verb: 'replied to a comment in' },
  share: { icon: Share2, verb: 'shared' },
  deadline: { icon: CalendarClock, verb: 'reminds you about the deadline for' },
} as const;

/**
 * The bell: mentions, replies and shares, newest first. Opening an entry
 * marks it read and goes to its document.
 */
export function NotificationBell() {
  const router = useRouter();
  const notifications = useQuery(api.notifications.list, {});
  const unread = useQuery(api.notifications.unreadCount, {}) ?? 0;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  const label = unread > 99 ? '99+' : String(unread);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread ? `Notifications, ${label} unread` : 'Notifications'}
        >
          <Bell />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white"
            >
              {label}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead({})}
              className="rounded text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-96 overflow-y-auto py-1">
          {notifications === undefined ? null : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing yet. Mentions, replies, shares and deadline reminders show up here.
            </p>
          ) : (
            notifications.map((n) => {
              const { icon: Icon, verb } = KIND[n.kind];
              return (
                <DropdownMenuItem
                  key={n._id}
                  onSelect={() => {
                    if (!n.readAt) void markRead({ id: n._id });
                    router.push(`/docs/${n.documentSlug}`);
                  }}
                  className="items-start gap-2.5 px-3 py-2"
                >
                  <span className="relative mt-0.5 shrink-0">
                    {n.actorAvatar ? (
                      <Image
                        src={n.actorAvatar}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 rounded-full"
                      />
                    ) : (
                      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {n.actorName[0]}
                      </span>
                    )}
                    <Icon className="absolute -right-1 -bottom-1 size-3.5! rounded-full bg-background p-0.5 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 text-xs">
                    <span className="block leading-snug">
                      <span className="font-semibold">{n.actorName}</span> {verb}{' '}
                      <span className="font-semibold">
                        {n.documentTitle || 'Untitled Document'}
                      </span>
                    </span>
                    {n.preview && (
                      <span className="mt-0.5 line-clamp-2 block text-muted-foreground">
                        {n.kind === 'share' || n.kind === 'deadline' ? n.preview : `“${n.preview}”`}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && (
                    <span
                      role="img"
                      aria-label="Unread"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                  )}
                </DropdownMenuItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
