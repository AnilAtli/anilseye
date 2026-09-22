import { DIRECTORY_ENDPOINT, RADIO_UUID_RE } from './policy.js';
import {
  normalizeRadioBrowserStation,
  publicRadioStation,
} from '../../sources/radioBrowser.js';

const BROWSER_DIRECTORY_URLS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];
const BROWSER_DIRECTORY_TTL_MS = 10 * 60 * 1000;
let browserDirectory = null;
let browserDirectoryRequest = null;

async function readBrowserDirectory(fetchImpl, signal) {
  if (
    browserDirectory &&
    Date.now() - browserDirectory.at < BROWSER_DIRECTORY_TTL_MS
  )
    return browserDirectory.body;
  if (!browserDirectoryRequest) {
    browserDirectoryRequest = (async () => {
      let lastError;
      const query = new URLSearchParams({
        has_geo_info: 'true',
        is_https: 'true',
        hidebroken: 'true',
        order: 'clickcount',
        reverse: 'true',
        limit: '800',
      });
      for (const origin of BROWSER_DIRECTORY_URLS) {
        try {
          const response = await fetchImpl(
            `${origin}/json/stations/search?${query}`,
            { signal },
          );
          if (!response.ok)
            throw new Error(`Radio Browser HTTP ${response.status}`);
          const rows = await response.json();
          if (!Array.isArray(rows))
            throw new Error('Malformed radio directory');
          const stations = rows
            .map(normalizeRadioBrowserStation)
            .filter(Boolean)
            .slice(0, 750)
            .map(publicRadioStation);
          if (!stations.length) throw new Error('No playable radio stations');
          const at = Date.now();
          const body = {
            stations,
            updatedAt: new Date(at).toISOString(),
            stale: false,
            degraded: false,
            acceptedGeneration: at,
            catalogInstance: 'radio-browser-direct',
          };
          browserDirectory = { at, body };
          return body;
        } catch (error) {
          if (signal?.aborted) throw error;
          lastError = error;
        }
      }
      if (browserDirectory) {
        return {
          ...browserDirectory.body,
          stale: true,
          degraded: true,
          degradedReason: 'refresh-failed',
        };
      }
      throw lastError;
    })().finally(() => {
      browserDirectoryRequest = null;
    });
  }
  const result = await browserDirectoryRequest;
  signal?.throwIfAborted();
  return result;
}

/** Supply directory metadata and click reporting; audio stays with the broadcaster. */
export function createRadioSource({
  fetchImpl = (...args) => globalThis.fetch(...args),
  browserDirect = false,
} = {}) {
  return {
    async getDirectory({ signal } = {}) {
      signal?.throwIfAborted();
      if (browserDirect) return readBrowserDirectory(fetchImpl, signal);
      const response = await fetchImpl(DIRECTORY_ENDPOINT, { signal });
      if (!response.ok)
        throw new Error(`Radio directory returned ${response.status}`);
      const body = await response.json();
      signal?.throwIfAborted();
      return body;
    },
    async recordClick(id, { signal } = {}) {
      if (typeof id !== 'string' || !RADIO_UUID_RE.test(id))
        throw new Error('Invalid radio station id');
      signal?.throwIfAborted();
      // Playback is direct to the broadcaster; click telemetry is optional.
      if (browserDirect) return;
      const response = await fetchImpl(
        `/api/radio/click/${encodeURIComponent(id)}`,
        {
          method: 'POST',
          signal,
        },
      );
      signal?.throwIfAborted();
      if (!response.ok)
        throw new Error(`Radio click returned ${response.status}`);
    },
  };
}
