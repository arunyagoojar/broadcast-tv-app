import db from '../constants/database.json';

export async function fetchChannelContent(channel) {

  // STANDARD CHANNELS LOGIC (Local Database)
  const channelData = db[channel.id];
  
  if (!channelData || channelData.length === 0) {
    return [
      {
        id: `fallback-${Math.random()}`,
        title: `No Signal (${channel.name})`,
        embedUrl: `https://vaplayer.ru/embed/movie/tt0468569?autoplay=1&hd=1&quality=1080p`,
        dur: 9120
      }
    ];
  }

  // Pick 10 random items from the database for this channel
  const shuffled = [...channelData].sort(() => Math.random() - 0.5).slice(0, 10);
  
  const fetchedItems = shuffled.map(item => {
    let embedUrl;
    let displayTitle = item.title;

    if (item.type === "tv") {
      const season = Math.floor(Math.random() * 3) + 1; // season 1-3
      const episode = Math.floor(Math.random() * 10) + 1; // episode 1-10
      embedUrl = `https://vaplayer.ru/embed/tv/${item.id}/${season}/${episode}?autoplay=1&hd=1&quality=1080p`;
      displayTitle = `${item.title} (S${season}E${episode})`;
    } else {
      embedUrl = `https://vaplayer.ru/embed/movie/${item.id}?autoplay=1&hd=1&quality=1080p`;
    }

    return {
      id: item.id + '-' + Math.random().toString(36).substring(2, 9),
      title: displayTitle,
      embedUrl: embedUrl,
      dur: item.type === "tv" ? 1320 : 5400
    };
  });

  return fetchedItems;
}
