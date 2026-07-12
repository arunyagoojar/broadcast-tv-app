import fs from 'fs';

const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

// Resolve via TMDB search (name -> tmdb id -> imdb id + logo). More reliable than
// IMDb free-text search for these ambiguous titles.
// [channelName, tmdbSearchName, preferYear]
const SHOWS = [
  ['Universe', 'The Universe', 2007],
  ['Dragon Ball', 'Dragon Ball Z', 1989],
  ['Popeye', 'Popeye the Sailor', null],
  ['The Pink Panther', 'The Pink Panther Show', null],
];

async function tmdbSearchTv(name, year) {
  const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`);
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  let best = data.results[0];
  if (year) {
    const yr = data.results.find((r) => (r.first_air_date || '').startsWith(String(year)));
    if (yr) best = yr;
  }
  return best;
}

async function getExternalAndLogo(tmdbId) {
  const extRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
  const ext = await extRes.json();
  const imdbId = ext.imdb_id || null;
  const imgRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`);
  const imgData = await imgRes.json();
  let logoUrl = null;
  if (imgData.logos && imgData.logos.length > 0) {
    imgData.logos.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    const best = imgData.logos.find((l) => l.iso_639_1 === 'en') || imgData.logos[0];
    if (best && best.file_path) logoUrl = `https://image.tmdb.org/t/p/w500${best.file_path}`;
  }
  return { imdbId, logoUrl };
}

async function fetchTvMazeData(imdbId) {
  if (!imdbId) return null;
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
  for (const [name, query, year] of SHOWS) {
    const hit = await tmdbSearchTv(query, year);
    if (!hit) { console.log(`MISS ${name}`); continue; }
    const { imdbId, logoUrl } = await getExternalAndLogo(hit.id);
    const entry = { channelName: name, id: imdbId, title: hit.name, type: 'tv', logoUrl };
    const tv = await fetchTvMazeData(imdbId);
    if (tv) { entry.seasons = tv.seasons; entry.maxEpisodes = tv.maxEpisodes; }
    data[name] = entry;
    console.log(`OK ${name} -> ${imdbId} (${hit.name}, ${hit.first_air_date}) logo=${logoUrl ? 'y' : 'n'} seasons=${tv ? tv.seasons.length : '-'}`);
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync('scripts/newData.json', JSON.stringify(data, null, 2));
  console.log('Merged TMDB-search results into scripts/newData.json');
}

main();
