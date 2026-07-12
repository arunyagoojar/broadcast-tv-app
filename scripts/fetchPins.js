import fs from 'fs';

const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

// Corrections / hard-pinned IMDB ids where the free-text search picked the wrong title.
const PINS = {
  'NOVA': 'tt0206501',        // PBS science series (search returned Terra Nova)
  'Universe': 'tt0902144',    // The Universe (History, 2007) — search returned wrong film
  'Dragon Ball': 'tt0214341', // Dragon Ball Z (re-fetch to grab logo)
};

async function fetchTmdbLogo(imdbId) {
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`);
    const findData = await findRes.json();
    let tmdbId, type;
    if (findData.tv_results && findData.tv_results.length > 0) { tmdbId = findData.tv_results[0].id; type = 'tv'; }
    else if (findData.movie_results && findData.movie_results.length > 0) { tmdbId = findData.movie_results[0].id; type = 'movie'; }
    if (!tmdbId) return { logoUrl: null, title: null, type: 'tv' };
    const title = type === 'tv' ? findData.tv_results[0].name : findData.movie_results[0].title;
    const imgRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`);
    const imgData = await imgRes.json();
    let logoUrl = null;
    if (imgData.logos && imgData.logos.length > 0) {
      imgData.logos.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      const best = imgData.logos.find((l) => l.iso_639_1 === 'en') || imgData.logos[0];
      if (best && best.file_path) logoUrl = `https://image.tmdb.org/t/p/w500${best.file_path}`;
    }
    return { logoUrl, title, type };
  } catch {
    return { logoUrl: null, title: null, type: 'tv' };
  }
}

async function fetchTvMazeData(imdbId) {
  try {
    const lookupRes = await fetch(`https://api.tvmaze.com/lookup/shows?imdb=${imdbId}`);
    if (!lookupRes.ok) return null;
    const showData = await lookupRes.json();
    const epRes = await fetch(`https://api.tvmaze.com/shows/${showData.id}/episodes`);
    if (!epRes.ok) return null;
    const episodes = await epRes.json();
    const maxEpisodes = {};
    for (const ep of episodes) if (ep.season && ep.number) maxEpisodes[ep.season] = Math.max(maxEpisodes[ep.season] || 0, ep.number);
    const seasons = Object.keys(maxEpisodes).map(Number).sort((a, b) => a - b);
    if (seasons.length === 0) return null;
    return { seasons, maxEpisodes };
  } catch { return null; }
}

async function main() {
  const data = JSON.parse(fs.readFileSync('scripts/newData.json', 'utf8'));
  for (const [name, id] of Object.entries(PINS)) {
    const { logoUrl, title } = await fetchTmdbLogo(id);
    const tv = await fetchTvMazeData(id);
    data[name] = { channelName: name, id, title: title || name, type: 'tv', logoUrl };
    if (tv) { data[name].seasons = tv.seasons; data[name].maxEpisodes = tv.maxEpisodes; }
    console.log(`PIN ${name} -> ${id} (${title}) logo=${logoUrl ? 'y' : 'n'} seasons=${tv ? tv.seasons.length : '-'}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync('scripts/newData.json', JSON.stringify(data, null, 2));
  console.log('Merged pins into scripts/newData.json');
}

main();
