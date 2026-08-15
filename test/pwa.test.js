import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readPngDimensions(relativePath) {
  const bytes = readFileSync(new URL(relativePath, import.meta.url));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('PWA manifest has separate exact-size regular and maskable icons', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  const icons = new Map(manifest.icons.map((icon) => [icon.src, icon]));

  for (const size of [192, 512]) {
    const regularPath = `/app-icon-${size}.png`;
    const maskablePath = `/app-maskable-${size}.png`;
    assert.equal(icons.get(regularPath)?.purpose, 'any');
    assert.equal(icons.get(maskablePath)?.purpose, 'maskable');
    assert.deepEqual(readPngDimensions(`../public${regularPath}`), { width: size, height: size });
    assert.deepEqual(readPngDimensions(`../public${maskablePath}`), { width: size, height: size });
  }
});

test('PWA updates wait for the viewer before restarting playback', () => {
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const installStart = worker.indexOf("self.addEventListener('install'");
  const installEnd = worker.indexOf("self.addEventListener('message'", installStart);
  const installHandler = worker.slice(installStart, installEnd);
  assert.match(worker, /event\.data\?\.type === 'SKIP_WAITING'/);
  assert.doesNotMatch(installHandler, /self\.skipWaiting\(\)/);
});
