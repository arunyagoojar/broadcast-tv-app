import test from 'node:test';
import assert from 'node:assert/strict';

import { moveDifferentItemFirst, moveFreshItemFirst } from '../src/utils/playlist.js';

const isSameItem = (a, b) => a.id === b.id;

test('refresh moves a different playable item to the front', () => {
  const current = { id: 'same' };
  const items = [{ id: 'same' }, { id: 'different' }, { id: 'third' }];

  const refreshed = moveDifferentItemFirst(items, current, isSameItem);

  assert.equal(refreshed[0].id, 'different');
  assert.deepEqual(refreshed.map((item) => item.id), ['different', 'third', 'same']);
});

test('refresh keeps the playlist intact when no alternative exists', () => {
  const items = [{ id: 'only' }];
  assert.equal(moveDifferentItemFirst(items, items[0], isSameItem), items);
});

test('refresh prefers an item outside recent playback history', () => {
  const current = { id: 'same' };
  const items = [{ id: 'same' }, { id: 'recent' }, { id: 'fresh' }];
  const refreshed = moveFreshItemFirst(items, current, ['recent'], isSameItem, (item) => item.id);

  assert.equal(refreshed[0].id, 'fresh');
});
