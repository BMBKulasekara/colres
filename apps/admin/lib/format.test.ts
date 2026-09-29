import { describe, expect, test } from 'vitest';
import { dayLabel, formatRelative, initials, percentChange, pluralize } from './format';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const NOW = new Date('2026-03-15T12:00:00').getTime();

describe('formatRelative', () => {
  test('anything under a minute is "just now"', () => {
    expect(formatRelative(NOW - 30 * 1000, NOW)).toBe('just now');
  });

  test('picks the largest whole unit', () => {
    expect(formatRelative(NOW - 3 * MINUTE, NOW)).toBe('3 minutes ago');
    expect(formatRelative(NOW - DAY, NOW)).toBe('yesterday');
    expect(formatRelative(NOW - 14 * DAY, NOW)).toBe('2 weeks ago');
  });

  test('handles timestamps in the future', () => {
    expect(formatRelative(NOW + 2 * 60 * MINUTE, NOW)).toBe('in 2 hours');
  });
});

describe('pluralize', () => {
  test('uses the singular only for exactly one', () => {
    expect(pluralize(1, 'document')).toBe('1 document');
    expect(pluralize(0, 'document')).toBe('0 documents');
    expect(pluralize(1200, 'user')).toBe('1,200 users');
  });

  test('accepts an irregular plural', () => {
    expect(pluralize(2, 'person', 'people')).toBe('2 people');
  });
});

describe('initials', () => {
  test('takes the first and last word', () => {
    expect(initials('Ada King Lovelace')).toBe('AL');
    expect(initials('grace')).toBe('G');
  });

  test('falls back to "?" for a missing or blank name', () => {
    expect(initials(undefined)).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('percentChange', () => {
  test('rounds to a whole percent', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(2, 3)).toBe(-33);
  });

  test('has no baseline to compare against when the previous value is zero', () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe('dayLabel', () => {
  test('names today and yesterday, and dates anything older', () => {
    expect(dayLabel(NOW - 60 * MINUTE, NOW)).toBe('Today');
    expect(dayLabel(NOW - DAY, NOW)).toBe('Yesterday');
    expect(dayLabel(NOW - 3 * DAY, NOW)).toBe('Mar 12, 2026');
  });
});
