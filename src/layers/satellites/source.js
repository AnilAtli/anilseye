import { readBrowserTle } from '../../data/browserTle.js';

const GROUPS = new Set([
  'stations',
  'visual',
  'gps-ops',
  'glo-ops',
  'galileo',
  'geo',
  'starlink',
]);

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
