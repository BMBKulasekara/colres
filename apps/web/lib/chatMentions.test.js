import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findMentionedIds,
  mentionQueryAt,
  splitMentions,
} from '../../../packages/convex/convex/lib/chatMentions.ts';

const ADA = { id: 'u_ada', name: 'Ada Lovelace' };
const ADAM = { id: 'u_adam', name: 'Adam' };
const GRACE = { id: 'u_grace', name: 'Grace Hopper' };

const people = [ADA, ADAM, GRACE];

test('a mention is split out of the surrounding text', () => {
  assert.deepEqual(splitMentions('hey @Adam can you look?', people), [
    { type: 'text', text: 'hey ' },
    { type: 'mention', text: '@Adam', userId: 'u_adam' },
    { type: 'text', text: ' can you look?' },
  ]);
});

/**
 * The failure this guards against is subtle: matching the shorter name first
 * turns "@Ada Lovelace" into a mention of Adam's namesake plus the stray text
 * " Lovelace", which reads as a typo rather than as a bug.
 */
test('a longer name wins over a shorter one it starts with', () => {
  assert.deepEqual(splitMentions('@Ada Lovelace please review', people), [
    { type: 'mention', text: '@Ada Lovelace', userId: 'u_ada' },
    { type: 'text', text: ' please review' },
  ]);
});

test('an @ that names nobody in the room stays plain text', () => {
  assert.deepEqual(splitMentions('@lunch at one', people), [
    { type: 'text', text: '@lunch at one' },
  ]);
});

test('several mentions in one message are all found, without duplicates', () => {
  assert.deepEqual(findMentionedIds('@Adam and @Grace Hopper and @Adam again', people), [
    'u_adam',
    'u_grace',
  ]);
});

test('text with no mentions yields no ids', () => {
  assert.deepEqual(findMentionedIds('no one in particular', people), []);
});

test('the picker opens on a partial name at the caret', () => {
  const text = 'hey @ad';
  assert.deepEqual(mentionQueryAt(text, text.length), { query: 'ad', from: 4, to: 7 });
});

test('the picker opens on an @ at the very start of the message', () => {
  assert.deepEqual(mentionQueryAt('@a', 2), { query: 'a', from: 0, to: 2 });
});

/**
 * Without this, typing an email address opens the picker halfway through and
 * then rewrites the address when a name is chosen.
 */
test('an @ inside a word does not open the picker', () => {
  const text = 'write to ada@example.com';
  assert.equal(mentionQueryAt(text, text.length), null);
});

test('the picker closes once the author has moved on to a sentence', () => {
  const text = '@Ada Lovelace please take a look';
  assert.equal(mentionQueryAt(text, text.length), null);
});

test('a name with one space is still a candidate', () => {
  const text = '@Grace Hop';
  assert.deepEqual(mentionQueryAt(text, text.length), { query: 'Grace Hop', from: 0, to: 10 });
});
