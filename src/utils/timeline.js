import { normalizeDurationSeconds } from './playerEvents.js';

function snapshotAtIndex(state, itemIndex, now) {
  const elapsed = Math.max(0, (now - state.startedAt) / 1000);
  const accumulatedBefore = state.playlist.slice(0, itemIndex)
    .reduce((total, item) => total + Math.max(0, Number(item.dur) || 0), 0);
  const currentItem = state.playlist[itemIndex];
  return {
    currentItem,
    resumeAt: Math.max(0, elapsed - accumulatedBefore),
    elapsed,
    accumulatedBefore,
    itemIndex,
    totalDuration: accumulatedBefore + Math.max(0, Number(currentItem.dur) || 0),
  };
}

export function getTimelineSnapshot(state, now = Date.now()) {
  const elapsed = Math.max(0, (now - (state?.startedAt ?? now)) / 1000);
  let accumulated = 0;
  const playlist = state?.playlist || [];
  for (let i = 0; i < playlist.length; i++) {
    const dur = Math.max(0, Number(playlist[i].dur) || 0);
    if (dur === 0 || elapsed < accumulated + dur) return snapshotAtIndex(state, i, now);
    accumulated += dur;
  }
  return {
    currentItem: null, resumeAt: Math.max(0, elapsed - accumulated), elapsed,
    accumulatedBefore: accumulated, itemIndex: -1, totalDuration: accumulated,
  };
}

export function getActivePlaybackSnapshot(state, activePlayback, now = Date.now()) {
  if (!activePlayback?.itemId || !state?.playlist?.length) return getTimelineSnapshot(state, now);
  // A movie or episode can appear more than once in a continuous schedule.
  // Its catalog ID alone does not identify the occurrence currently playing.
  const index = activePlayback.itemIndex;
  if (Number.isInteger(index) && state.playlist[index]?.id === activePlayback.itemId) {
    return snapshotAtIndex(state, index, now);
  }
  return getTimelineSnapshot(state, now);
}

export function syncReportedDuration(state, snapshot, reportedDuration) {
  const duration = normalizeDurationSeconds(reportedDuration);
  const index = snapshot?.itemIndex;
  if (duration === null || !state?.playlist?.[index]) return false;
  const currentItem = state.playlist[index];
  if (Math.abs((Number(currentItem.dur) || 0) - duration) < 2 && currentItem.durationTrusted) return false;
  state.playlist = state.playlist.map((item, itemIndex) => (
    itemIndex === index ? { ...item, dur: duration, durationTrusted: true } : item
  ));
  return true;
}

export function alignTimelineToProgress(state, snapshot, progress, now = Date.now()) {
  if (!snapshot?.currentItem || !Number.isFinite(progress) || progress < 0) return;
  state.startedAt = now - ((snapshot.accumulatedBefore + progress) * 1000);
}
