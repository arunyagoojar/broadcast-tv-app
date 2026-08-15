const MAX_REPORTED_DURATION_SECONDS = 12 * 60 * 60;
const MIN_REPORTED_DURATION_SECONDS = 60;

function parseSecondsValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(trimmed)) {
    const parts = trimmed.split(':').map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => (total * 60) + part, 0);
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProgressSeconds(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  return value > MAX_REPORTED_DURATION_SECONDS ? value / 1000 : value;
}

export function normalizeDurationSeconds(value) {
  const duration = parseSecondsValue(value);
  if (!Number.isFinite(duration) || duration <= 0) return null;
  const seconds = duration > MAX_REPORTED_DURATION_SECONDS
    ? duration / 1000
    : duration;
  if (
    !Number.isFinite(seconds) ||
    seconds < MIN_REPORTED_DURATION_SECONDS ||
    seconds > MAX_REPORTED_DURATION_SECONDS
  ) {
    return null;
  }
  return Math.round(seconds);
}

export function readProgressSeconds(progress) {
  const directSeconds = parseSecondsValue(progress);
  if (directSeconds !== null) return normalizeProgressSeconds(directSeconds);

  if (!progress || typeof progress !== 'object') return null;
  if (
    Number.isFinite(Number(progress.played)) &&
    Number(progress.played) > 0 &&
    Number(progress.played) <= 1 &&
    normalizeDurationSeconds(progress.duration) !== null
  ) {
    return Number(progress.played) * normalizeDurationSeconds(progress.duration);
  }

  const candidates = [
    progress.currentTime,
    progress.current_time,
    progress.current,
    progress.position,
    progress.seconds,
    progress.time,
    progress.elapsed,
    progress.currentTimeText,
    progress.current_time_text,
    progress.positionText,
    Number(progress.played) > 1 ? progress.played : undefined,
  ];
  const found = candidates.map(parseSecondsValue).find((value) => value !== null);
  return found === undefined ? null : normalizeProgressSeconds(found);
}

export function readProgressDurationSeconds(progress) {
  if (!progress || typeof progress !== 'object') return null;

  const candidates = [
    progress.player_duration,
    progress.duration,
    progress.dur,
    progress.totalDuration,
    progress.total_duration,
    progress.length,
    progress.total,
    progress.totalTime,
    progress.total_time,
    progress.durationText,
    progress.duration_text,
    progress.lengthText,
  ];
  const found = candidates.find((value) => normalizeDurationSeconds(value) !== null);
  return found === undefined ? null : normalizeDurationSeconds(found);
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function normalizePlayerStatus(value) {
  if (value === 0 || value === '0') return 'ended';
  if (value === 1 || value === '1') return 'playing';
  if (value === 2 || value === '2') return 'paused';
  return String(value || '').toLowerCase().trim();
}

export function isPlayingStatus(status) {
  return status === 'playing' || status === 'play';
}

export function isCompletionStatus(status) {
  return [
    'completed',
    'complete',
    'ended',
    'end',
    'finished',
    'finish',
  ].includes(status);
}

function hasProgressShape(value) {
  if (!value || typeof value !== 'object') return false;
  return [
    'currentTime',
    'current_time',
    'current',
    'position',
    'seconds',
    'time',
    'played',
    'duration',
    'dur',
    'totalDuration',
    'total_duration',
    'length',
  ].some((key) => value[key] !== undefined);
}

export function readPlayerEventPayload(message) {
  const parsed = parseMaybeJson(message);
  if (!parsed || typeof parsed !== 'object') return null;

  // Current vaplayer/VidAPI contract.
  if (parsed.type === 'PLAYER_EVENT' && parsed.data && typeof parsed.data === 'object') {
    return {
      player_status: normalizePlayerStatus(parsed.data.player_status),
      player_progress: parsed.data.player_progress,
      player_duration: parsed.data.player_duration,
      player_info: parsed.data.player_info,
    };
  }

  // Retain compatibility with older provider payload variants.
  const candidates = [
    parsed,
    parseMaybeJson(parsed.data),
    parseMaybeJson(parsed.detail),
    parseMaybeJson(parsed.payload),
  ].filter((item) => item && typeof item === 'object');

  for (const candidate of candidates) {
    const progress = candidate.player_progress ?? candidate.progress ?? candidate.currentProgress;
    const eventName = normalizePlayerStatus(candidate.type ?? candidate.event ?? candidate.name);
    const eventStatus = isPlayingStatus(eventName) || isCompletionStatus(eventName) ? eventName : undefined;
    const status = candidate.player_status ?? candidate.status ?? candidate.state ?? candidate.playerState ?? eventStatus;

    if (status !== undefined || progress !== undefined || hasProgressShape(candidate)) {
      return {
        player_status: normalizePlayerStatus(status),
        player_progress: progress ?? candidate,
        player_duration: candidate.player_duration,
        player_info: candidate.player_info,
      };
    }
  }

  return null;
}
