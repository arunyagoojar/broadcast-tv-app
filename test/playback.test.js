import test from 'node:test';
import assert from 'node:assert/strict';
import { getRandomStartOffset, hasPlaybackAdvanced } from '../src/utils/playback.js';

test('a two-hour movie tunes between 8 and 56 percent of its runtime', () => {
  const item = { dur: 7200, durationTrusted: true };
  assert.equal(getRandomStartOffset(item, () => 0), 576);
  assert.equal(getRandomStartOffset(item, () => 0.999999), 4032);
});

test('unknown runtimes still start in progress with a conservative random offset', () => {
  const movie = { dur: 7200, durationTrusted: false };
  assert.equal(getRandomStartOffset(movie, () => 0), 30);
  assert.equal(getRandomStartOffset(movie, () => 0.999999), 180);
  assert.equal(getRandomStartOffset({ ...movie, seriesId: 'tt1' }, () => 0.999999), 90);
});

test('an initial playing message cannot dismiss loading before progress advances', () => {
  assert.equal(hasPlaybackAdvanced(null, 120), false);
  assert.equal(hasPlaybackAdvanced(120, 120), false);
  assert.equal(hasPlaybackAdvanced(120, 125), true);
});
