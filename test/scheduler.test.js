import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlayableItem, generateConsecutiveEpisodes } from '../src/utils/scheduler.js';

test('a 24/7 show channel wraps from its finale to the first episode', () => {
  const show = { id: 'tt0012345', title: 'Fixture', type: 'tv', seasons: [1, 2], maxEpisodes: { 1: 3, 2: 2 } };
  const items = generateConsecutiveEpisodes(show, { count: 4, afterItem: buildPlayableItem(show, 2, 2) });
  assert.deepEqual(items.map(item => [item.season, item.episode]), [[1, 1], [1, 2], [1, 3], [2, 1]]);
});

test('missing metadata still produces a finite timeline without claiming an exact runtime', () => {
  const episode = buildPlayableItem({ id: 'tt0012345', title: 'Fixture', type: 'tv', duration: 1320 }, 1, 1);
  assert.equal(episode.dur, 1320);
  assert.equal(episode.durationTrusted, false);
  const movie = buildPlayableItem({ id: 'tt0012346', title: 'Fixture', type: 'movie' });
  assert.ok(movie.dur > 0);
  assert.equal(movie.durationTrusted, false);
});
