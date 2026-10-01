import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeleteForever,
  daysUntilPurge,
  purgeTimeFor,
  TRASH_RETENTION_MS,
} from '../../../packages/convex/convex/lib/trashPolicy.ts';

const DAY = 24 * 60 * 60 * 1000;

const facts = (overrides) => ({
  isAuthor: false,
  isPersonal: false,
  callerIsOrgAdmin: false,
  authorStillMember: true,
  ...overrides,
});

test('the author can always delete forever', () => {
  assert.equal(canDeleteForever(facts({ isAuthor: true })), true);
  assert.equal(canDeleteForever(facts({ isAuthor: true, isPersonal: true })), true);
});

test('an org admin can delete forever only once the author has left', () => {
  assert.equal(canDeleteForever(facts({ callerIsOrgAdmin: true, authorStillMember: false })), true);
  assert.equal(canDeleteForever(facts({ callerIsOrgAdmin: true, authorStillMember: true })), false);
});

test('an ordinary member cannot delete forever, even after the author has left', () => {
  assert.equal(canDeleteForever(facts({ authorStillMember: false })), false);
});

test('nobody but the author can delete a personal document forever', () => {
  assert.equal(
    canDeleteForever(facts({ isPersonal: true, callerIsOrgAdmin: true, authorStillMember: false })),
    false
  );
});

test('items stay in the bin for 30 days', () => {
  assert.equal(TRASH_RETENTION_MS, 30 * DAY);
  assert.equal(purgeTimeFor(1_000), 1_000 + 30 * DAY);
});

test('days left counts up to the next whole day and never goes negative', () => {
  const now = 0;
  assert.equal(daysUntilPurge(30 * DAY, now), 30);
  assert.equal(daysUntilPurge(DAY / 2, now), 1);
  assert.equal(daysUntilPurge(-DAY, now), 0);
});
