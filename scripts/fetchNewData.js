import fs from 'fs';

const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

// Single-show channels that need: reliable IMDB id, TMDB clearlogo, TVMaze seasons.
// Format: [displayName, searchQuery, isTv]
const SHOWS = [
  // ── TV Shows ──
  ['Mr. Bean', 'Mr. Bean', true],
  ['Brooklyn Nine-Nine', 'Brooklyn Nine-Nine', true],
  ['Parks and Recreation', 'Parks and Recreation', true],
  ['Modern Family', 'Modern Family', true],
  ['How I Met Your Mother', 'How I Met Your Mother', true],
  ['Seinfeld', 'Seinfeld', true],
  ['Malcolm in the Middle', 'Malcolm in the Middle', true],
  ['Community', 'Community', true],
  ['Two and a Half Men', 'Two and a Half Men', true],
  ['Fresh Prince of Bel-Air', 'The Fresh Prince of Bel-Air', true],
  // ── Sketch & Stand ──
  ['Key & Peele', 'Key and Peele', true],
  ['Saturday Night Live', 'Saturday Night Live', true],
  ['Whose Line Is It Anyway?', 'Whose Line Is It Anyway', true],
  ["Monty Python's Flying Circus", "Monty Python's Flying Circus", true],
  ["Chappelle's Show", "Chappelle's Show", true],
  ['I Think You Should Leave with Tim Robinson', 'I Think You Should Leave with Tim Robinson', true],
  // ── Animation ──
  ['Tom & Jerry', 'Tom and Jerry', true],
  ['Looney Tunes', 'Looney Tunes', true],
  ['Scooby-Doo', 'Scooby-Doo, Where Are You!', true],
  ['Popeye', 'Popeye the Sailor', true],
  ['The Pink Panther', 'The Pink Panther Show', true],
  ['Futurama', 'Futurama', true],
  ["Bob's Burgers", "Bob's Burgers", true],
  ['King of the Hill', 'King of the Hill', true],
  ['Adventure Time', 'Adventure Time', true],
  ['Courage the Cowardly Dog', 'Courage the Cowardly Dog', true],
  ['Pokemon', 'Pokemon', true],
  ['Beyblade', 'Beyblade', true],
  ['Dragon Ball', 'Dragon Ball', true],
  ['Naruto', 'Naruto', true],
  // ── Heroes ──
  ['Invincible', 'Invincible', true],
  ['The Boys', 'The Boys', true],
  ['Watchmen', 'Watchmen HBO', true],
  // ── Documentaries (single-show) ──
  ['Planet Earth', 'Planet Earth', true],
  ['Blue Planet', 'The Blue Planet', true],
  ['Prehistoric Planet', 'Prehistoric Planet', true],
  ['Frozen Planet', 'Frozen Planet', true],
  ['Cosmos', 'Cosmos: A Spacetime Odyssey', true],
  ['NOVA', 'NOVA', true],
  ['Modern Marvels', 'Modern Marvels', true],
  ['Universe', 'The Universe', true],
  ['MythBusters', 'MythBusters', true],
  ['Kitchen Nightmares', 'Kitchen Nightmares', true],
  ["Hell's Kitchen", "Hell's Kitchen", true],
  ['Top Gear', 'Top Gear', true],
  // ── Louie (verify correct id — bug: Old Christine was playing) ──
  ['Louie', 'Louie', true],
];

async function fetchImdbId(query, isTv) {
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`);
    const data = await res.json();
    if (data && data.d) {
      for (const item of data.d) {
        if (!item.id || !item.id.startsWith('tt')) continue;
        const kind = item.qid || item.q || '';
        const itemIsTv = /tvSeries|tvMiniSeries|TV series|TV mini/i.test(kind);
        if (isTv && itemIsTv) return { id: item.id, title: item.l, type: 'tv' };
        if (!isTv && !itemIsTv && /movie|feature|tvMovie|video/i.test(kind)) return { id: item.id, title: item.l, type: 'movie' };
      }
      // Fallback: first tt result of the right-ish type
      const first = data.d.find((i) => i.id && i.id.startsWith('tt'));
      if (first) return { id: first.id, title: first.l, type: isTv ? 'tv' : 'movie' };
    }
  } catch {
    console.error(`IMDb fetch failed: ${query}`);
  }
  return null;
}

async function fetchTmdbLogo(imdbId) {
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`);
    const findData = await findRes.json();
    let tmdbId, type;
    if (findData.tv_results && findData.tv_results.length > 0) {
      tmdbId = findData.tv_results[0].id; type = 'tv';
    } else if (findData.movie_results && findData.movie_results.length > 0) {
      tmdbId = findData.movie_results[0].id; type = 'movie';
    }
    if (!tmdbId) return null;
    const imgRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`);
    const imgData = await imgRes.json();
    if (imgData.logos && imgData.logos.length > 0) {
      imgData.logos.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      const best = imgData.logos.find((l) => l.iso_639_1 === 'en') || imgData.logos[0];
      if (best && best.file_path) return `https://image.tmdb.org/t/p/w500${best.file_path}`;
    }
  } catch {
    console.error(`TMDB logo fetch failed: ${imdbId}`);
  }
  return null;
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
    for (const ep of episodes) {
      if (ep.season && ep.number) maxEpisodes[ep.season] = Math.max(maxEpisodes[ep.season] || 0, ep.number);
    }
    const seasons = Object.keys(maxEpisodes).map(Number).sort((a, b) => a - b);
    if (seasons.length === 0) return null;
    return { seasons, maxEpisodes };
  } catch {
    return null;
  }
}

async function main() {
  const out = {};
  for (const [name, query, isTv] of SHOWS) {
    const resolved = await fetchImdbId(query, isTv);
    if (!resolved) { console.log(`MISS: ${name}`); continue; }
    const entry = { channelName: name, id: resolved.id, title: resolved.title, type: resolved.type };
    await new Promise((r) => setTimeout(r, 120));
    entry.logoUrl = await fetchTmdbLogo(resolved.id);
    await new Promise((r) => setTimeout(r, 120));
    if (resolved.type === 'tv') {
      const tv = await fetchTvMazeData(resolved.id);
      if (tv) { entry.seasons = tv.seasons; entry.maxEpisodes = tv.maxEpisodes; }
      await new Promise((r) => setTimeout(r, 400));
    }
    out[name] = entry;
    console.log(`OK: ${name} -> ${resolved.id} (${resolved.title}) logo=${entry.logoUrl ? 'y' : 'n'} seasons=${entry.seasons ? entry.seasons.length : '-'}`);
  }
  fs.writeFileSync('scripts/newData.json', JSON.stringify(out, null, 2));
  console.log(`\nWrote scripts/newData.json with ${Object.keys(out).length} shows.`);
}

main();
