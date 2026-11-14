import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('every artwork reference is a bundled file with no remote image fallback', () => {
  for (const name of ['logos', 'channelLogos', 'channelPosters', 'franchiseLogos', 'streamingLogos']) {
    const entries = JSON.parse(readFileSync(new URL(`../src/constants/${name}.json`, import.meta.url), 'utf8'));
    for (const [key, path] of Object.entries(entries)) {
      if (!path) continue;
      assert.match(path, /^\/artwork\//, `${name}:${key} uses a remote source`);
      assert.ok(existsSync(new URL(`../public${path}`, import.meta.url)), `${name}:${key} has no local file`);
    }
  }
});
