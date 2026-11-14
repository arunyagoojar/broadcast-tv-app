import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('a cache quota failure does not turn a successful script fetch into a network error', async () => {
  const handlers = {};
  const cache = { put: async () => { throw new Error('QuotaExceededError'); }, keys: async () => [] };
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://broadcast.test' }, addEventListener: (type, fn) => { handlers[type] = fn; } },
    caches: { open: async () => cache, match: async () => undefined },
    fetch: async () => new Response('working-script'), URL, Response,
  });
  let result;
  handlers.fetch({
    request: { method: 'GET', url: 'https://broadcast.test/assets/app.js', mode: 'cors', destination: 'script' },
    respondWith: promise => { result = promise; }, waitUntil() {},
  });
  assert.equal(await (await result).text(), 'working-script');
});

test('activation does not delete unrelated applications caches on the same origin', async () => {
  const handlers = {};
  const deleted = [];
  vm.runInNewContext(source, {
    self: { addEventListener: (type, fn) => { handlers[type] = fn; }, clients: { claim() {} } },
    caches: { keys: async () => ['another-app-cache', 'broadcast-tv-shell-v1'], delete: async key => deleted.push(key) },
  });
  let pending;
  handlers.activate({ waitUntil: promise => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted, ['broadcast-tv-shell-v1']);
});
