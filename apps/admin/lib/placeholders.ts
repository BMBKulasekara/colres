/** Stable string keys for a fixed number of loading placeholders. */
export function placeholderKeys(count: number, prefix = 'placeholder'): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}
