import fs from 'fs';

const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

// One representative, recognizable title per logoless (genre/collection) channel.
// Chosen to be visually distinct from each other where possible.
const REP = {
  'Action': 'The Avengers',
  'Adventure': 'Pirates of the Caribbean: The Curse of the Black Pearl',
  'Comedy': 'The Hangover',
  'Romance': 'The Notebook',
  'Horror & Thriller': 'The Conjuring',
  'Crime': 'Zodiac',
  'Sci-Fi': 'Star Wars',
  'Fantasy': 'The Lord of the Rings: The Fellowship of the Ring',
  'Musicals': 'La La Land',
  'Nostalgia': 'Back to the Future',
  'Family': 'Toy Story',
  'Mystery': 'Gone Girl',
  'Superhero Cinema': 'The Dark Knight',
  'Hindi Comedy': 'Hera Pheri',
  'Hindi OG Movies': 'Sholay',
  'Hindi Nostalgia': 'Malgudi Days',
  'Stand-Up': 'Dave Chappelle: Sticks & Stones',
  'Animation Giants': 'Shrek',
  'History Channel': 'The Men Who Built America',
  'BBC History': 'A History of Britain',
  'Mega Builds': 'Megastructures',
  'Crime Documentaries': 'Making a Murderer',
  'NASA': 'Return to Space',
};

async function searchPoster(query) {
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
  const data = await res.json();
  if (!data.results) return null;
  const withPoster = data.results.filter((r) => r.poster_path && (r.media_type === 'movie' || r.media_type === 'tv'));
  if (withPoster.length === 0) return null;
  // TMDB orders by popularity; the first poster-bearing result is almost always right.
  const best = withPoster[0];
  return {
    title: best.title || best.name,
    poster: `https://image.tmdb.org/t/p/w342${best.poster_path}`,
  };
}

async function main() {
  const out = {};
  for (const [channel, query] of Object.entries(REP)) {
    const hit = await searchPoster(query);
    if (!hit) { console.log(`MISS: ${channel} (${query})`); continue; }
    out[channel] = hit.poster;
    console.log(`OK: ${channel} -> ${hit.title}`);
    await new Promise((r) => setTimeout(r, 120));
  }
  fs.writeFileSync('scripts/posters.json', JSON.stringify(out, null, 2));
  console.log(`\nWrote scripts/posters.json with ${Object.keys(out).length} posters.`);
}

main();
