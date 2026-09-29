'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../lib/convex-error';

type Messages<TResult> = {
  /** Toast on success; a function receives the result. Omit for no toast. */
  success?: string | ((result: TResult) => string);
  /** Prefix for the error toast; the server's reason is appended. */
  error?: string;
};

/**
 * Runs a mutation or action with a pending flag, a success toast, and a
 * readable error toast. Resolves to the result, or `undefined` on failure, so
 * callers never need their own try/catch just to show a message.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  messages: Messages<TResult> = {}
) {
  const [pending, setPending] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setPending(true);
    try {
      const result = await fnRef.current(...args);
      const { success } = messagesRef.current;
      if (success) toast.success(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (error) {
      const reason = errorMessage(error);
      const prefix = messagesRef.current.error;
      toast.error(prefix ? `${prefix}: ${reason}` : reason);
      return undefined;
    } finally {
      setPending(false);
    }
  }, []);

  return { run, pending };
}
