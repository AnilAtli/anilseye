import assert from 'node:assert/strict';
import test from 'node:test';
import { createBikeshareSource } from './source.js';
import { GBFS_CITY_REGISTRY } from './registry.js';
test('station source keeps upstream URLs behind the fixed GBFS endpoint', async () => {
  const calls = [];
  const source = createBikeshareSource({
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response('{"data":{"stations":[]}}');
    },
  });
  for (const url of [
    'file:///etc/passwd',
    'http://example.test/stations',
    'https://user:pass@example.test/stations',
  ])
    await assert.rejects(source.getStations(url), /HTTPS GBFS/);
  assert.equal(calls.length, 0);
  await source.getStations('https://example.test/stations.json');
  const url = new URL(calls[0][0], 'https://app.example');
  assert.equal(url.search, '');
  assert.equal(
    decodeURIComponent(url.pathname.replace(/^\/api\/gbfs\//, '')),
    'https://example.test/stations.json',
  );
});
test('cancelled station parsing never publishes the response', async () => {
  const controller = new AbortController();
  const source = createBikeshareSource({
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        controller.abort();
        return { data: { stations: [] } };
      },
    }),
  });
  await assert.rejects(
    source.getStations('https://example.test/stations', {
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
});

test('static station source uses only registered CORS feeds directly', async () => {
  const calls = [];
  const source = createBikeshareSource({
    browserDirect: true,
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response('{"data":{"stations":[]}}');
    },
  });
  const url = GBFS_CITY_REGISTRY[0].stationStatusUrl;
  await source.getStations(url);
  assert.deepEqual(calls, [url]);
  await assert.rejects(
    source.getStations('https://example.test/stations.json'),
    /Unknown GBFS feed/,
  );
});
