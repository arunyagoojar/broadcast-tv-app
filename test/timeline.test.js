import test from 'node:test';
import assert from 'node:assert/strict';
import { getTimelineSnapshot, getActivePlaybackSnapshot, alignTimelineToProgress, syncReportedDuration } from '../src/utils/timeline.js';

test('repeated movies identify the playing occurrence rather than the first matching ID', () => {
  const state = { startedAt: 0, playlist: [{ id: 'repeat', dur: 1000 }, { id: 'other', dur: 1000 }, { id: 'repeat', dur: 1000 }] };
  const snapshot = getActivePlaybackSnapshot(state, { itemId: 'repeat', itemIndex: 2 }, 2_500_000);
  assert.equal(snapshot.itemIndex, 2);
  assert.equal(snapshot.resumeAt, 500);
});

test('buffering does not advance the active programme ahead of reported progress', () => {
  const state = { startedAt: 0, playlist: [{ id: 'first', dur: 1000 }, { id: 'second', dur: 1000 }] };
  const active = { itemId: 'first', itemIndex: 0 };
  alignTimelineToProgress(state, getActivePlaybackSnapshot(state, active, 120_000), 5, 120_000);
  assert.equal(getTimelineSnapshot(state, 120_000).resumeAt, 5);
  // Once tuned away, the virtual broadcast continues to progress.
  assert.equal(getTimelineSnapshot(state, 180_000).resumeAt, 65);
});

test('a reported runtime corrects only the active schedule occurrence', () => {
  const state = { startedAt: 0, playlist: [{ id: 'repeat', dur: 1000 }, { id: 'repeat', dur: 1000 }] };
  assert.equal(syncReportedDuration(state, { itemIndex: 1 }, 900), true);
  assert.deepEqual(state.playlist.map(item => item.dur), [1000, 900]);
  assert.equal(syncReportedDuration(state, { itemIndex: 1 }, 900), false);
});
