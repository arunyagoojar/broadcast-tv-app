import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

test('a wake lock resolving after unmount is immediately released', async () => {
  let cleanup;
  let resolveRequest;
  let releases = 0;
  const source = readFileSync(new URL('../src/hooks/useWakeLock.js', import.meta.url), 'utf8')
    .replace("import { useEffect } from 'react';", '')
    .replace('export function', 'function');
  vm.runInNewContext(`${source}\nuseWakeLock(true);`, {
    useEffect: effect => { cleanup = effect(); },
    navigator: { wakeLock: { request: () => new Promise(resolve => { resolveRequest = resolve; }) } },
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    console,
  });
  cleanup();
  resolveRequest({ release: async () => { releases++; } });
  // The requested promise crosses a VM realm; drain its continuation before
  // checking the release performed by the hook.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(releases, 1);
});
