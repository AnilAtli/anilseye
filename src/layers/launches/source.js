import { launchLibraryRecentUrl } from '../../data/spaceProviderRequests.js';
import { readBrowserTle } from '../satellites/source.js';

const LAUNCH_CACHE_MS = 15 * 60 * 1000;
let browserLaunches = null;

/** Read launch records and their optional active-orbit catalog with explicit cancellation. */
export function createLaunchSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  browserDirect = false,
} = {}) {
  return {
    async getLaunches({ signal } = {}) {
      signal?.throwIfAborted();
      if (
        browserDirect &&
        browserLaunches &&
        Date.now() - browserLaunches.at < LAUNCH_CACHE_MS
      )
        return browserLaunches.payload;
      const endpoint = browserDirect
        ? launchLibraryRecentUrl(new Date()).href
        : '/api/launches';
      const response = await fetchImpl(endpoint, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      signal?.throwIfAborted();
      if (!Array.isArray(payload) && !Array.isArray(payload?.results))
        throw new Error('Malformed launch snapshot');
      if (browserDirect) browserLaunches = { at: Date.now(), payload };
      return payload;
    },
    async getActiveTle({ signal } = {}) {
      signal?.throwIfAborted();
      if (browserDirect) return readBrowserTle('active', { signal, fetchImpl });
      const response = await fetchImpl('/api/celestrak/active', { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      signal?.throwIfAborted();
      return text;
    },
  };
}
