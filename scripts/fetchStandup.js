import fs from 'fs';

const TMDB_API_KEY = '1c29feb59f90480282165ab1fdee190f';

// Standup specials (movies) for the single Stand-Up channel. Runtime plays these
// randomized. We pin IMDB ids + logos so resolution is reliable.
const SPECIALS = [
  // Louis C.K.
  'Louis C.K.: Hilarious', 'Louis C.K.: Live at the Beacon Theater', 'Louis C.K.: Oh My God',
  'Louis C.K.: Chewed Up', 'Louis C.K.: Shameless', 'Louis C.K. 2017',
  // Dave Chappelle
  'Dave Chappelle: Sticks & Stones', 'Dave Chappelle: The Closer', 'Dave Chappelle: Equanimity',
  'Dave Chappelle: The Age of Spin', 'Dave Chappelle: Deep in the Heart of Texas',
  // Bill Burr
  'Bill Burr: Paper Tiger', 'Bill Burr: Walk Your Way Out', "Bill Burr: I'm Sorry You Feel That Way",
  'Bill Burr: Let It Go',
  // Ricky Gervais
  'Ricky Gervais: Humanity', 'Ricky Gervais: SuperNature', 'Ricky Gervais: Armageddon',
  // Jim Gaffigan
  'Jim Gaffigan: Mr. Universe', 'Jim Gaffigan: Obsessed', 'Jim Gaffigan: Cinco', 'Jim Gaffigan: Quality Time',
  // Gabriel Iglesias
  "Gabriel Iglesias: I'm Sorry for What I Said When I Was Hungry", 'Gabriel Iglesias: One Show Fits All',
  'Gabriel Iglesias: Stadium Fluffy',
  // Kevin Hart
  'Kevin Hart: Laugh at My Pain', 'Kevin Hart: Let Me Explain', 'Kevin Hart: What Now?', 'Kevin Hart: Irresponsible',
  // Jo Koy
  'Jo Koy: Live from Seattle', "Jo Koy: Comin' in Hot", 'Jo Koy: In His Elements',
  // Russell Peters
  'Russell Peters: Almost Famous', 'Russell Peters: Notorious', 'Russell Peters: Red, White and Brown',
  // John Mulaney
  'John Mulaney: Kid Gorgeous at Radio City', 'John Mulaney: The Comeback Kid', 'John Mulaney: New in Town',
  'John Mulaney: Baby J',
];

async function fetchImdbId(query) {
  try {
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`);
    const data = await res.json();
    if (data && data.d) {
      const hit = data.d.find((i) => i.id && i.id.startsWith('tt'));
      if (hit) return { id: hit.id, title: hit.l };
    }
  } catch { /* ignore */ }
  return null;
}

async function fetchTmdbLogo(imdbId) {
  try {
    const findRes = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_API_KEY}`);
    const findData = await findRes.json();
    let tmdbId, type;
    if (findData.movie_results && findData.movie_results.length > 0) { tmdbId = findData.movie_results[0].id; type = 'movie'; }
    else if (findData.tv_results && findData.tv_results.length > 0) { tmdbId = findData.tv_results[0].id; type = 'tv'; }
    if (!tmdbId) return null;
    const imgRes = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`);
    const imgData = await imgRes.json();
    if (imgData.logos && imgData.logos.length > 0) {
      imgData.logos.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      const best = imgData.logos.find((l) => l.iso_639_1 === 'en') || imgData.logos[0];
      if (best && best.file_path) return `https://image.tmdb.org/t/p/w500${best.file_path}`;
    }
  } catch { /* ignore */ }
  return null;
}

async function main() {
  const out = {};
  for (const title of SPECIALS) {
    const r = await fetchImdbId(title);
    if (!r) { console.log(`MISS: ${title}`); continue; }
    await new Promise((res) => setTimeout(res, 100));
    const logoUrl = await fetchTmdbLogo(r.id);
    out[title] = { id: r.id, title: r.title, type: 'movie', logoUrl };
    console.log(`OK: ${title} -> ${r.id} (${r.title}) logo=${logoUrl ? 'y' : 'n'}`);
    await new Promise((res) => setTimeout(res, 120));
  }
  fs.writeFileSync('scripts/standup.json', JSON.stringify(out, null, 2));
  console.log(`\nWrote scripts/standup.json with ${Object.keys(out).length} specials.`);
}

main();
