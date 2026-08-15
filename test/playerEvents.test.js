import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isCompletionStatus,
  normalizeDurationSeconds,
  readPlayerEventPayload,
  readProgressSeconds,
} from '../src/utils/playerEvents.js';

test('parses the documented vaplayer PLAYER_EVENT payload', () => {
  const payload = readPlayerEventPayload({
    type: 'PLAYER_EVENT',
    data: {
      player_info: { imdb: 'tt0111161', mediaType: 'movie' },
      player_status: 'playing',
      player_progress: 125.4,
      player_duration: 8546,
    },
  });

  assert.equal(payload.player_status, 'playing');
  assert.equal(payload.player_progress, 125.4);
  assert.equal(payload.player_duration, 8546);
  assert.equal(payload.player_info.imdb, 'tt0111161');
});

test('retains compatibility with JSON-string and legacy progress payloads', () => {
  const payload = readPlayerEventPayload(JSON.stringify({
    event: 'playback',
    status: 'completed',
    progress: { currentTime: '01:02', duration: '02:00' },
  }));

  assert.equal(payload.player_status, 'completed');
  assert.equal(readProgressSeconds(payload.player_progress), 62);
  assert.equal(isCompletionStatus(payload.player_status), true);
});

test('normalizes millisecond durations and rejects implausible values', () => {
  assert.equal(normalizeDurationSeconds(7_200_000), 7200);
  assert.equal(normalizeDurationSeconds(30), null);
  assert.equal(normalizeDurationSeconds('not-a-duration'), null);
});
