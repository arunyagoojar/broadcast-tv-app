export async function searchChannels(query) {
  // If query is empty, return the single test channel for "The Dark Knight"
  if (!query || !query.trim()) {
    const embedUrl = `https://vaplayer.ru/embed/movie/tt0468569?autoplay=1`;
    return [
      {
        id: `dark-knight-test`,
        title: `The Dark Knight [Test Channel]`,
        embedUrl: embedUrl,
        dur: 9120 // 152 mins
      }
    ];
  }

  // Otherwise, query the IMDb suggestion API via our local CORS proxy
  try {
    const res = await fetch(`/api/imdb?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.d)) {
        // Map suggestion list to channels
        const channels = data.d
          .filter(item => item.id && item.id.startsWith("tt")) // ensure valid IMDB ID
          .map(item => {
            const isTv = item.qid === "tvSeries" || (item.q && item.q.toLowerCase().includes("tv"));
            
            // Random start time (e.g. 5 to 30 mins)
            const randomStart = Math.floor(Math.random() * (1800 - 300 + 1)) + 300;
            
            let embedUrl = "";
            let displayTitle = item.l;

            if (isTv) {
              // TV Series: choose a random season/episode for surfing
              const season = Math.floor(Math.random() * 3) + 1; // season 1-3
              const episode = Math.floor(Math.random() * 10) + 1; // episode 1-10
              embedUrl = `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}?autoplay=1&resumeAt=${randomStart}`;
              displayTitle = `${item.l} (S${season}E${episode})`;
            } else {
              // Movie
              embedUrl = `https://vaplayer.ru/embed/movie/${item.id}?autoplay=1&resumeAt=${randomStart}`;
            }

            return {
              id: item.id,
              title: `${displayTitle} [${item.y || "N/A"}]`,
              embedUrl: embedUrl,
              dur: isTv ? 1320 : 5400 // mock duration
            };
          });
        return channels.slice(0, 10); // return top 10 matches
      }
    }
  } catch (e) {
    console.error("[TV] IMDb API lookup failed:", e);
  }

  // Fallback to test channel if search fails
  return searchChannels("");
}
