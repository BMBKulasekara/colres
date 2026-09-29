export type Range = '7d' | '30d' | '90d';

export const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function parseRange(value: string | undefined): Range {
  return value === '30d' || value === '90d' ? value : '7d';
}
