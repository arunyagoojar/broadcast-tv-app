import { getRandomKeyword } from '../constants/channels';

export async function fetchChannelContent(channel) {
  if (channel.imdbIds && channel.imdbIds.length > 0) {
    let fetchedItems = [];
    for (let i = 0; i < 10; i++) {
      const imdbId = channel.imdbIds[Math.floor(Math.random() * channel.imdbIds.length)];
      
      // Random season 1-9, Random episode 1-20
      const season = Math.floor(Math.random() * 9) + 1;
      const episode = Math.floor(Math.random() * 20) + 1;
      
      const embedUrl = `https://vaplayer.ru/embed/tv/${imdbId}/${season}/${episode}?autoplay=1`;
      const baseName = channel.name.replace(' (24/7)', '');
      
      fetchedItems.push({
        id: imdbId + '-' + Math.random().toString(36).substring(2, 9),
        title: `${baseName} (S${season}E${episode})`,
        embedUrl: embedUrl,
        dur: 1320
      });
    }
    return fetchedItems;
  }

  // Randomly select a keyword from the channel's keyword pool
  const query = getRandomKeyword(channel);

  try {
    const res = await fetch(`/api/imdb?q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.d)) {
        // Map suggestion list to channels
        let fetchedItems = data.d
          .filter(item => item.id && item.id.startsWith("tt")) // ensure valid IMDB ID
          .map(item => {
            const isTv = item.qid === "tvSeries" || (item.q && item.q.toLowerCase().includes("tv"));
            
            let embedUrl;
            let displayTitle = item.l;

            if (isTv) {
              // TV Series: choose a random season/episode for surfing
              const season = Math.floor(Math.random() * 3) + 1; // season 1-3
              const episode = Math.floor(Math.random() * 10) + 1; // episode 1-10
              embedUrl = `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}?autoplay=1`;
              displayTitle = `${item.l} (S${season}E${episode})`;
            } else {
              // Movie
              embedUrl = `https://vaplayer.ru/embed/movie/${item.id}?autoplay=1`;
            }

            return {
              id: item.id + '-' + Math.random().toString(36).substring(2, 9), // unique key to prevent history conflicts
              title: `${displayTitle} [${item.y || "N/A"}]`,
              embedUrl: embedUrl,
              dur: isTv ? 1320 : 5400 // mock duration (22 mins vs 90 mins)
            };
          });
          
        // Shuffle the results to ensure dynamic feeling
        fetchedItems = fetchedItems.sort(() => Math.random() - 0.5).slice(0, 10);
        
        if (fetchedItems.length > 0) return fetchedItems;
      }
    }
  } catch (e) {
    console.error("[TV] IMDb API lookup failed:", e);
  }

  // Fallback to a default item if everything fails
  return [
    {
      id: `fallback-${Math.random()}`,
      title: `No Signal (${channel.name})`,
      embedUrl: `https://vaplayer.ru/embed/movie/tt0468569?autoplay=1`,
      dur: 9120
    }
  ];
}
