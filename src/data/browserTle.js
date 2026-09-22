const GROUPS = new Set([
  'stations',
  'visual',
  'gps-ops',
  'glo-ops',
  'galileo',
  'geo',
  'starlink',
  'active',
]);

const TLE_CACHE_MS = 6 * 60 * 60 * 1000;
const browserCatalog = new Map();

/** Read CelesTrak directly only for static hosting; keep a six-hour browser cache. */
export async function readBrowserTle(
  group,
  { signal, fetchImpl = fetch } = {},
) {
  if (!GROUPS.has(group)) throw new TypeError('Unknown satellite group');
  signal?.throwIfAborted();
  const now = Date.now();
  const cached = browserCatalog.get(group);
  if (cached && now - cached.at < TLE_CACHE_MS) return cached.text;
  const cache = globalThis.caches
    ? await caches.open('anilseye-celestrak-v1').catch(() => null)
    : null;
  const url = new URL('https://celestrak.org/NORAD/elements/gp.php');
  url.searchParams.set('GROUP', group);
  url.searchParams.set('FORMAT', 'tle');
  const cacheKey = url.href;
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
