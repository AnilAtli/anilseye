import { celestrakTleUrl } from '../../data/spaceProviderRequests.js';

const GROUPS = new Set([
  'stations',
  'visual',
  'gps-ops',
  'glo-ops',
  'galileo',
  'geo',
  'starlink',
]);

const TLE_CACHE_MS = 6 * 60 * 60 * 1000;
const browserCatalog = new Map();

/** Read CelesTrak directly only for static hosting; keep a six-hour browser cache. */
export async function readBrowserTle(
  group,
  { signal, fetchImpl = fetch } = {},
) {
  if (!GROUPS.has(group) && group !== 'active')
    throw new TypeError('Unknown satellite group');
  signal?.throwIfAborted();
  const now = Date.now();
  const cached = browserCatalog.get(group);
  if (cached && now - cached.at < TLE_CACHE_MS) return cached.text;
  const cache = globalThis.caches
    ? await caches.open('anilseye-celestrak-v1').catch(() => null)
    : null;
  const cacheKey = celestrakTleUrl(group).href;
  const stored = cache ? await cache.match(cacheKey).catch(() => null) : null;
  const storedAt = Number(stored?.headers.get('x-anilseye-cached-at'));
  if (stored && Number.isFinite(storedAt) && now - storedAt < TLE_CACHE_MS) {
    const text = await stored.text();
    browserCatalog.set(group, { at: storedAt, text });
    return text;
  }
  try {
    const response = await fetchImpl(cacheKey, { signal });
    if (!response.ok) throw new Error(`CelesTrak HTTP ${response.status}`);
    const text = await response.text();
    signal?.throwIfAborted();
    if (!/^1 /m.test(text)) throw new Error('Malformed CelesTrak catalog');
    const at = Date.now();
    browserCatalog.set(group, { at, text });
    await cache
      ?.put(
        cacheKey,
        new Response(text, { headers: { 'x-anilseye-cached-at': String(at) } }),
      )
      .catch(() => {});
    return text;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (cached) return cached.text;
    if (stored) return stored.text();
    throw error;
  }
}

/** Read catalog text from the existing group endpoint using a supplied transport. */
export function createSatelliteSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  browserDirect = false,
} = {}) {
  return {
    async readGroup(group, { signal } = {}) {
      if (!GROUPS.has(group)) throw new TypeError('Unknown satellite group');
      signal?.throwIfAborted();
      if (browserDirect) {
        try {
          const text = await readBrowserTle(group, { signal, fetchImpl });
          return { ok: true, status: 200, text };
        } catch (error) {
          if (signal?.aborted) throw error;
          return { ok: false, status: 503, text: '' };
        }
      }
      const response = await fetchImpl(`/api/celestrak/${group}`, { signal });
      const text = response.ok ? await response.text() : '';
      signal?.throwIfAborted();
      return { ok: response.ok, status: response.status, text };
    },
  };
}
