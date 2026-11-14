import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
} });

test('title normalization resolves The Big Bang Theory and The Simpsons', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/lookup/shows')) return Response.json({ id: 123, averageRuntime: 22 });
    if (url.includes('/episodes')) return Response.json([{ season: 1, number: 1, name: 'Pilot', runtime: 22 }]);
    if (url.includes('/find/')) return Response.json({ tv_results: [{ id: 123 }] });
    return Response.json({ episode_run_time: [22] });
  };
  try {
    const { fetchChannelContent } = await server.ssrLoadModule('/src/api/channels.js');
    for (const [id, title, imdb] of [[23, 'The Big Bang Theory', 'tt0898266'], [27, 'The Simpsons', 'tt0096697']]) {
      const items = await fetchChannelContent({ id, curatedTitles: [title] });
      assert.equal(items.length, 40);
      assert.ok(items.every(item => item.seriesId === imdb));
    }
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(fetchChannelContent({ id: 23 }, { signal: controller.signal }), { name: 'AbortError' });
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});

test('an unresponsive metadata service cannot prevent a local movie from tuning', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  try {
    const { fetchChannelContent } = await server.ssrLoadModule('/src/api/channels.js');
    const started = Date.now();
    const items = await fetchChannelContent({ id: 1 });
    assert.ok(Date.now() - started < 6000);
    assert.ok(items.length > 0);
    assert.ok(items.every(item => item.dur > 0 && item.embedUrl));
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});
