export function buildPlayableItem(item, forcedSeason = null, forcedEpisode = null) {
  const isTv = item.type === 'tv';
  let season = forcedSeason;
  let episode = forcedEpisode;

  if (isTv && (season === null || episode === null)) {
    if (item.seasons && item.seasons.length > 0 && item.maxEpisodes) {
      season = item.seasons[Math.floor(Math.random() * item.seasons.length)];
      const maxEp = item.maxEpisodes[season] || 1;
      episode = Math.floor(Math.random() * maxEp) + 1;
    } else {
      season = Math.floor(Math.random() * 3) + 1;
      episode = Math.floor(Math.random() * 10) + 1;
    }
  }

  const base = isTv
    ? `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}`
    : `https://vaplayer.ru/embed/movie/${item.id}`;

  const epKey = `${season}-${episode}`;
  const epTitle = item.episodeTitles && item.episodeTitles[epKey] 
    ? item.episodeTitles[epKey]
    : `(S${season}E${episode})`;

  return {
    id: isTv ? `${item.id}-s${season}e${episode}` : `${item.id}-movie`,
    seriesId: isTv ? item.id : null,
    season: isTv ? season : null,
    episode: isTv ? episode : null,
    title: item.title,
    epTitle: isTv ? epTitle : '',
    logoUrl: item.logoUrl || null,
    embedUrl: `${base}?autoplay=1&hd=1&quality=1080p`,
    dur: isTv
      ? Number(item.episodeDurations?.[epKey]) || Number(item.duration) || 1800
      : Number(item.duration) || 7200,
    durationTrusted: isTv
      ? Number(item.episodeDurations?.[epKey]) > 0
      : Number(item.duration) > 0,
  };
}

export function generateConsecutiveEpisodes(tvShow, { count = 3, afterItem = null } = {}) {
  const episodes = [];
  const hasSeasonData = Boolean(tvShow.seasons?.length && tvShow.maxEpisodes);
  const initialSeason = hasSeasonData
    ? tvShow.seasons[Math.floor(Math.random() * tvShow.seasons.length)]
    : Math.floor(Math.random() * 3) + 1;
  const maxEp = hasSeasonData ? (tvShow.maxEpisodes[initialSeason] || 1) : 10;
  
  const continuing = afterItem?.seriesId === tvShow.id && Number(afterItem.season) > 0 && Number(afterItem.episode) > 0;
  let currentEp = continuing ? Number(afterItem.episode) + 1 : Math.floor(Math.random() * maxEp) + 1;
  let currentSeason = continuing ? Number(afterItem.season) : initialSeason;
  
  for (let i = 0; i < count; i++) {
    const currentSeasonMax = tvShow.maxEpisodes ? (tvShow.maxEpisodes[currentSeason] || 1) : 10;
    
    if (currentEp > currentSeasonMax) {
      if (tvShow.seasons) {
        const idx = tvShow.seasons.indexOf(currentSeason);
        if (idx !== -1 && idx < tvShow.seasons.length - 1) {
          currentSeason = tvShow.seasons[idx + 1];
          currentEp = 1;
        } else {
          currentSeason = tvShow.seasons[0];
          currentEp = 1;
        }
      } else {
        currentSeason++;
        currentEp = 1;
        if (currentSeason > 3) currentSeason = 1;
      }
    }
    
    episodes.push(buildPlayableItem(tvShow, currentSeason, currentEp));
    currentEp++;
  }
  return episodes;
}

