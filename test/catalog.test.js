import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { CHANNELS } from '../src/constants/channels.js';

const database = JSON.parse(readFileSync(new URL('../src/constants/database.json', import.meta.url), 'utf8'));
const catalogDirectory = new URL('../src/constants/catalog/', import.meta.url);

test('lazy channel catalogs exactly match the authoritative database', () => {
  const files = readdirSync(catalogDirectory).filter((file) => file.endsWith('.json')).sort();
  assert.deepEqual(files, Object.keys(database).map((id) => `${id}.json`).sort());

  for (const file of files) {
    const channelId = file.replace('.json', '');
    const records = JSON.parse(readFileSync(new URL(file, catalogDirectory), 'utf8'));
    assert.deepEqual(records, database[channelId]);
  }
});

test('precompiled records have valid identifiers, types, titles, and no channel duplicates', () => {
  for (const [channelId, records] of Object.entries(database)) {
    assert.ok(records.length > 0, `channel ${channelId} is empty`);
    assert.equal(new Set(records.map((item) => item.id)).size, records.length, `channel ${channelId} has duplicate IDs`);
    for (const item of records) {
      assert.match(item.id, /^tt\d+$/, `${item.title} has an invalid IMDb ID`);
      assert.ok(['movie', 'tv'].includes(item.type), `${item.title} has an invalid type`);
      assert.ok(item.title?.trim(), `channel ${channelId} has an empty title`);
      if (item.duration !== undefined) {
        assert.ok(Number(item.duration) > 0, `${item.title} has an invalid runtime`);
      }
    }
  }
});

test('Sony Superheroes uses an exact precompiled catalog', () => {
  const channel = CHANNELS.find((item) => item.name === 'Sony Superheroes');
  assert.ok(channel);

  const records = database[channel.id];
  assert.equal(records.length, channel.curatedTitles.length);
  assert.deepEqual(records.map((item) => item.title), channel.curatedTitles);
  assert.equal(new Set(records.map((item) => item.id)).size, records.length);
  assert.ok(records.every((item) => /^tt\d+$/.test(item.id)));
  assert.ok(records.every((item) => item.duration > 0));
});

test('all menu channels have a built-in artwork fallback', () => {
  const menuSource = readFileSync(new URL('../src/components/LeftMenu.jsx', import.meta.url), 'utf8');
  assert.match(menuSource, /function ChannelFallbackIcon/);
  assert.match(menuSource, /<ChannelFallbackIcon group=\{channel\.group\}/);
});

test('runtime title selection never calls an external title-search API', () => {
  const channelApi = readFileSync(new URL('../src/api/channels.js', import.meta.url), 'utf8');
  assert.doesNotMatch(channelApi, /media-imdb\.com\/suggestion|searchTitle\(/);
  assert.match(channelApi, /catalogIndex\.json/);
});
