const numberFormat = new Intl.NumberFormat('en-US');
const dateFormat = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const relativeFormat = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDate(timestamp: number): string {
  return dateFormat.format(timestamp);
}

export function formatDateTime(timestamp: number): string {
  return dateTimeFormat.format(timestamp);
}

export function formatTime(timestamp: number): string {
  return timeFormat.format(timestamp);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** "3 minutes ago", "yesterday", "just now". */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const diff = timestamp - now;
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return relativeFormat.format(Math.round(diff / ms), unit);
    }
  }
  return 'just now';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

export function initials(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Percent change from `previous` to `current`, or null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** "Today", "Yesterday", or a date — for grouping feeds by day. */
export function dayLabel(timestamp: number, now: number = Date.now()): string {
  const day = new Date(timestamp).toDateString();
  if (day === new Date(now).toDateString()) return 'Today';
  if (day === new Date(now - 24 * 60 * 60 * 1000).toDateString()) return 'Yesterday';
  return formatDate(timestamp);
}
