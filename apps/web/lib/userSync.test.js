import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildUserProfilePayload } from './userSync.js';

test('builds a Convex-friendly payload from Clerk user data', () => {
  const payload = buildUserProfilePayload({
    id: 'user_123',
    fullName: 'Ada Lovelace',
    firstName: 'Ada',
    lastName: 'Lovelace',
    imageUrl: 'https://example.com/avatar.png',
    primaryEmailAddressId: 'email_1',
    emailAddresses: [{ id: 'email_1', emailAddress: 'ada@example.com' }],
  });

  assert.equal(payload.clerkId, 'user_123');
  assert.equal(payload.name, 'Ada Lovelace');
  assert.equal(payload.email, 'ada@example.com');
  assert.equal(payload.imageUrl, 'https://example.com/avatar.png');
});
