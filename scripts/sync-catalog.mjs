import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../src/constants/database.json', import.meta.url);
const outputDirectory = new URL('../src/constants/catalog/', import.meta.url);
const indexUrl = new URL('../src/constants/catalogIndex.json', import.meta.url);
const database = JSON.parse(await readFile(sourceUrl, 'utf8'));
const normalizeTitle = (title) => String(title || '')
  .toLowerCase()
  .replace(/^the\s+/, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const catalogIndex = {};
for (const record of Object.values(database).flat()) {
  const key = normalizeTitle(record.title);
  if (key && !catalogIndex[key]) catalogIndex[key] = record;
}

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  ...Object.entries(database).map(([channelId, records]) => (
  writeFile(
    new URL(`${channelId}.json`, outputDirectory),
    `${JSON.stringify(records, null, 2)}\n`,
    'utf8',
  )
  )),
  writeFile(indexUrl, `${JSON.stringify(catalogIndex, null, 2)}\n`, 'utf8'),
]);

console.log(`Synced ${Object.keys(database).length} channel catalogs.`);
