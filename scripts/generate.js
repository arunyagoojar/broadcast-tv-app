import fs from 'fs';

const newData = JSON.parse(fs.readFileSync('scripts/newData.json', 'utf8'));
const standup = JSON.parse(fs.readFileSync('scripts/standup.json', 'utf8'));
const logosPath = 'src/constants/logos.json';
const logos = JSON.parse(fs.readFileSync(logosPath, 'utf8'));

function norm(t) {
  return String(t || '').toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// 1. Merge all new logos into logos.json (id -> url)
let logoAdds = 0;
for (const s of Object.values(newData)) {
  if (s.id && s.logoUrl && !logos[s.id]) { logos[s.id] = s.logoUrl; logoAdds++; }
}
for (const s of Object.values(standup)) {
  if (s.id && s.logoUrl && !logos[s.id]) { logos[s.id] = s.logoUrl; logoAdds++; }
}
fs.writeFileSync(logosPath, JSON.stringify(logos, null, 2));

// 2. KNOWN_TITLES additions — keyed by normalize(channelName / curatedTitle)
const known = {};
for (const [channelName, s] of Object.entries(newData)) {
  known[norm(channelName)] = { id: s.id, title: channelName, type: s.type };
}
// standup specials: key by the special title (used verbatim in curatedTitles)
for (const [title, s] of Object.entries(standup)) {
  known[norm(title)] = { id: s.id, title, type: 'movie' };
}

const knownLines = Object.entries(known)
  .map(([k, v]) => `  '${k}': { id: '${v.id}', title: ${JSON.stringify(v.title)}, type: '${v.type}' },`)
  .join('\n');

// 3. CHANNEL_LOGO_IMDB additions (channelName -> imdbId) for single-show channels
const logoImdbLines = Object.entries(newData)
  .filter(([, s]) => s.id)
  .map(([channelName, s]) => `  ${JSON.stringify(channelName)}: '${s.id}',`)
  .join('\n');

fs.writeFileSync('scripts/generated.txt',
  `// ===== KNOWN_TITLES additions =====\n${knownLines}\n\n// ===== CHANNEL_LOGO_IMDB additions =====\n${logoImdbLines}\n`);

console.log(`Merged ${logoAdds} logos into logos.json (total ${Object.keys(logos).length}).`);
console.log(`Wrote scripts/generated.txt: ${Object.keys(known).length} KNOWN_TITLES, ${Object.keys(newData).length} CHANNEL_LOGO_IMDB entries.`);
