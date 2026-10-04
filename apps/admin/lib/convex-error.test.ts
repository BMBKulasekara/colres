import { ConvexError } from 'convex/values';
import { describe, expect, test } from 'vitest';
import { errorMessage } from './convex-error';

function serverError(message: string) {
  return new Error(
    `[CONVEX M(documents:adminUpdateDocument)] [Request ID: abc123] Server Error\nUncaught Error: ${message}\n    at handler (../convex/documents.ts:10:5)`
  );
}

describe('errorMessage', () => {
  test('keeps only the sentence meant for a reader from a server error', () => {
    expect(errorMessage(serverError('Slug "x" is already in use'))).toBe(
      'Slug "x" is already in use'
    );
  });

  test('translates auth failures into something actionable', () => {
    expect(errorMessage(serverError('Unauthenticated: no verified identity'))).toBe(
      'Your session has expired. Sign in again to continue.'
    );
    expect(errorMessage(serverError('Forbidden: this action requires an admin account'))).toBe(
      'You no longer have admin access.'
    );
  });

  test('uses the data of a ConvexError when it is a string', () => {
    expect(errorMessage(new ConvexError('Template name is required'))).toBe(
      'Template name is required'
    );
    expect(errorMessage(new ConvexError({ code: 42 }), 'Could not save')).toBe('Could not save');
  });

  test('never shows raw Convex framing or non-errors', () => {
    expect(errorMessage(new Error('[CONVEX Q(users:get)] Server Error'))).toBe(
      'Something went wrong'
    );
    expect(errorMessage('boom', 'Try again')).toBe('Try again');
  });
});
