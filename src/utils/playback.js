export function getRandomStartOffset(item, random = Math.random) {
  const duration = Number(item?.dur);
  if (!Number.isFinite(duration) || duration <= 120) return 0;
  const isEpisode = Boolean(item.seriesId || item.season);
  const minimum = item.durationTrusted ? Math.floor(duration * 0.08) : 30;
  const maximum = item.durationTrusted
    ? Math.floor(duration * 0.56)
    : Math.min(isEpisode ? 90 : 180, Math.floor(duration * 0.25));
  return Math.floor(random() * (Math.max(minimum, maximum) - minimum + 1)) + minimum;
}

export function hasPlaybackAdvanced(previousProgress, progress) {
  return Number.isFinite(previousProgress) && Number.isFinite(progress) && progress > previousProgress + 0.05;
}
