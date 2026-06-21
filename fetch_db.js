import fs from 'fs';

const titlesData = JSON.parse(fs.readFileSync('./titles.json', 'utf8'));

async function fetchImdbId(title, isTv) {
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(title)}.json`);
    const data = await res.json();
    if (data && data.d) {
      for (const item of data.d) {
        if (!item.id || !item.id.startsWith("tt")) continue;
        const itemIsTv = item.qid === "tvSeries" || item.qid === "tvMiniSeries" || (item.q && (item.q === "TV series" || item.q === "TV mini-series"));
        if (isTv && itemIsTv) {
          return { id: item.id, title: item.l, type: "tv" };
        } else if (!isTv && !itemIsTv) {
          return { id: item.id, title: item.l, type: "movie" };
        }
      }
    }
  } catch (e) {
    console.error(`Failed to fetch ${title}`);
  }
  return null;
}

async function main() {
  console.log("Fetching IMDB IDs for all channels...");
  const database = {};

  for (const [channelId, titles] of Object.entries(titlesData.movies)) {
    console.log(`Processing channel ${channelId} (Movies) - ${titles.length} titles...`);
    database[channelId] = [];
    for (const title of titles) {
      const result = await fetchImdbId(title, false);
      if (result) {
        // Prevent exact duplicates
        if (!database[channelId].find(i => i.id === result.id)) {
          database[channelId].push(result);
        }
      }
      // slight delay to prevent rate limit
      await new Promise(r => setTimeout(r, 80));
    }
  }

  for (const [channelId, titles] of Object.entries(titlesData.tv)) {
    console.log(`Processing channel ${channelId} (TV) - ${titles.length} titles...`);
    if (!database[channelId]) database[channelId] = [];
    for (const title of titles) {
      const result = await fetchImdbId(title, true);
      if (result) {
        if (!database[channelId].find(i => i.id === result.id)) {
          database[channelId].push(result);
        }
      }
      await new Promise(r => setTimeout(r, 80));
    }
  }

  fs.writeFileSync('src/constants/database.json', JSON.stringify(database, null, 2));
  console.log(`Wrote src/constants/database.json with ${Object.keys(database).length} channels.`);
}

main();
