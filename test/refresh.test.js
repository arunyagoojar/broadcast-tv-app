import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('refresh does not expose stale localhost files or a Click to Play prompt', () => {
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const playerStage = readFileSync(new URL('../src/components/PlayerStage.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

  assert.match(main, /import\.meta\.env\.DEV/);
  assert.match(main, /registration\.unregister\(\)/);
  assert.match(main, /wasControlled/);
  assert.match(main, /window\.location\.reload\(\)/);
  assert.doesNotMatch(playerStage, /CLICK TO PLAY|play-prompt/);
  assert.match(playerStage, /player-loading-cover/);
  assert.match(playerStage, /onLoad=\{onLoad\}/);
  assert.match(worker, /\['script', 'style', 'worker'\]/);
  assert.match(app, /channel\.id !== 0/);
});
