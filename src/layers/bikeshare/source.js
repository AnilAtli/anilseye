import { GBFS_CITY_REGISTRY } from './registry.js';

const PUBLIC_FEED_URLS = new Set(
  GBFS_CITY_REGISTRY.flatMap((city) => [
    city.stationInformationUrl,
    city.stationStatusUrl,
  ]),
);

/** Read a GBFS station document through the server or a CORS-enabled public feed. */
export function createBikeshareSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  browserDirect = false,
} = {}) {
  return {
    async getStations(upstreamUrl, { signal } = {}) {
      const url = new URL(upstreamUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash)
        throw new TypeError('A public HTTPS GBFS URL is required');
      if (browserDirect && !PUBLIC_FEED_URLS.has(url.href))
        throw new TypeError('Unknown GBFS feed');
      signal?.throwIfAborted();
      const response = await fetchImpl(
        browserDirect ? url.href : '/api/gbfs/' + encodeURIComponent(url.href),
        { method: 'GET', headers: { Accept: 'application/json' }, signal },
      );
      if (!response.ok) throw new Error('GBFS HTTP ' + response.status);
      const payload = await response.json();
      signal?.throwIfAborted();
      if (!payload || typeof payload !== 'object')
        throw new Error('Malformed GBFS payload');
      return payload;
    },
  };
}
