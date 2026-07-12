import fs from 'fs';

const KEY = '1c29feb59f90480282165ab1fdee190f';
const posters = JSON.parse(fs.readFileSync('scripts/posters.json', 'utf8'));

// Family resolved to the unreleased Toy Story 5 (teaser only) and clashed with the
// Shrek poster used for Animation Giants. Pin to Home Alone (1990) instead.
const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${KEY}&query=${encodeURIComponent('Home Alone')}&year=1990`);
const data = await res.json();
const hit = (data.results || []).find((r) => r.poster_path);
if (hit) {
  posters['Family'] = `https://image.tmdb.org/t/p/w342${hit.poster_path}`;
  console.log('Family ->', hit.title, posters['Family']);
}

fs.writeFileSync('src/constants/channelPosters.json', JSON.stringify(posters, null, 2));
console.log(`Wrote src/constants/channelPosters.json with ${Object.keys(posters).length} posters.`);
