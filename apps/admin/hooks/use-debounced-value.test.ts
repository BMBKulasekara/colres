import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useDebouncedValue } from './use-debounced-value';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  test('returns the initial value straight away', () => {
    const { result } = renderHook(() => useDebouncedValue('ada'));
    expect(result.current).toBe('ada');
  });

  test('only reports the latest value once typing pauses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ad' });
    act(() => vi.advanceTimersByTime(200));
    rerender({ value: 'ada' });
    act(() => vi.advanceTimersByTime(200));

    // 400ms have passed, but never 250ms without a change.
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(50));
    expect(result.current).toBe('ada');
  });
});
