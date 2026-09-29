import { ConvexError } from 'convex/values';

/**
 * A message fit to show a person, from whatever a Convex call threw.
 *
 * Server errors reach the client as
 *   "[CONVEX M(documents:adminUpdateDocument)] [Request ID: …] Server Error
 *    Uncaught Error: Slug "x" is already in use
 *        at handler (…)"
 * and only the sentence after "Uncaught Error:" is meant for a reader.
 */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ConvexError) {
    return typeof error.data === 'string' ? error.data : fallback;
  }
  if (!(error instanceof Error)) return fallback;

  const uncaught = /Uncaught (?:Error|ConvexError): (.+)/.exec(error.message);
  const message = (uncaught?.[1] ?? error.message).trim();

  if (/Unauthenticated/i.test(message)) {
    return 'Your session has expired. Sign in again to continue.';
  }
  if (/Forbidden|requires admin|not an admin/i.test(message)) {
    return 'You no longer have admin access.';
  }
  if (message.startsWith('[CONVEX')) return fallback;
  return message || fallback;
}
