'use client';

/**
 * Past this the exact figure stops being information and starts being a wide
 * badge over the corner of a button.
 */
const MAX_SHOWN = 99;

/**
 * The red count over the top-right corner of a button.
 *
 * Absolutely positioned against whatever it sits in, so the parent needs
 * `relative`. It is `aria-hidden` and paired with a plain-language label in
 * the button's own `aria-label`, because "4" read on its own out of a button
 * tells a screen-reader user nothing about what there are four of.
 */
export function UnreadBadge({ count, highlight = false }: { count: number; highlight?: boolean }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-background tabular-nums ${
        // A mention is worth distinguishing from ordinary chatter, and a ring
        // does it without introducing a second colour to the corner.
        highlight ? 'bg-red-600 ring-primary' : 'bg-red-600'
      }`}
    >
      {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
    </span>
  );
}

/** "3 unread messages" — the part a screen reader actually needs. */
export function unreadLabel(count: number, mentionsMe: boolean): string {
  if (count <= 0) return 'Collaboration panel';
  const messages = count === 1 ? '1 unread message' : `${count} unread messages`;
  return mentionsMe
    ? `Collaboration panel, ${messages}, one of them mentions you`
    : `Collaboration panel, ${messages}`;
}
