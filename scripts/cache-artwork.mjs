// Run only when updating artwork. The application itself never downloads art
// from these upstream URLs; it serves the generated files from public/artwork.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(await readFile(new URL('scripts/artwork-sources.json', root), 'utf8'));
const artworkDirectory = new URL('public/artwork/', root);
await mkdir(artworkDirectory, { recursive: true });

function canonicalUrl(source) {
  if (source.includes('image.tmdb.org')) return source.replace(/\/t\/p\/w\d+\//, '/t/p/w300/');
  if (source.includes('upload.wikimedia.org') && source.includes('.svg/')) {
    return source.replace('/commons/thumb/', '/commons/').replace(/\.svg\/.*$/, '.svg');
  }
  return source;
}

const urls = [...new Set(Object.values(sources).flatMap(Object.values).filter(Boolean).map(canonicalUrl))];
const downloaded = new Map();
const failures = [];
let nextIndex = 0;
let completed = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (nextIndex < urls.length) {
    const url = urls[nextIndex++];
    const extension = new URL(url).pathname.match(/\.(png|jpe?g|webp|svg)$/i)?.[1].toLowerCase() || 'png';
    const name = `${createHash('sha256').update(url).digest('hex').slice(0, 20)}.${extension}`;
    const file = new URL(name, artworkDirectory);
    try {
      try { await access(file); }
      catch {
        const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
          throw new Error(`HTTP ${response.status}`);
        }
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
      }
      downloaded.set(url, `/artwork/${name}`);
    } catch (error) {
      failures.push({ url, reason: error.message });
    }
    if (++completed % 100 === 0) console.log(`Cached ${completed}/${urls.length} artwork sources.`);
  }
}));

for (const [group, entries] of Object.entries(sources)) {
  const local = Object.fromEntries(Object.entries(entries).map(([key, url]) => [key, url ? downloaded.get(canonicalUrl(url)) || null : null]));
  await writeFile(new URL(`src/constants/${group}.json`, root), `${JSON.stringify(local, null, 2)}\n`);
}
await writeFile(new URL('scripts/artwork-report.json', root), `${JSON.stringify({ sources: urls.length, cached: downloaded.size, failures }, null, 2)}\n`);
console.log(`Bundled ${downloaded.size}/${urls.length} unique artwork files. ${failures.length} unavailable sources use the existing text/icon fallback.`);
