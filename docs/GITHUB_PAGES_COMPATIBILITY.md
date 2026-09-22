# GitHub Pages compatibility audit

The public site is served by GitHub Pages. Pages publishes the built `dist`
directory, but it does not run the Vite/Node middleware in `server/providers/`.
The source project expects that middleware for much of its live-data behavior.
As a result, building the project successfully is not evidence that every
control works on the public URL.

| Feature | Pages status | Reason |
| --- | --- | --- |
| Globe, styles, built-in geographic data, scene controls | Available | Browser-side assets and local data. External map tiles still depend on their providers. |
| Earthquakes | Available | USGS feed is fetched directly in the browser. |
| Satellites | Available | Direct CelesTrak CORS feed; catalog cached for six hours in browser Cache Storage when available. |
| Recent rocket launches | Available | Direct Launch Library 2 CORS feed and CelesTrak active orbit data. |
| Public radio | Available | Direct Radio Browser CORS directory and broadcaster audio; optional click-count telemetry is skipped. |
| Bike share | Partial | Registered GBFS feeds are fetched directly. Individual feeds may lack CORS or be temporarily down. |
| Public CCTV / camera monitoring | **Requires API server** | Twelve regional catalogs, live frame/media proxying, health checks, and browser-safe projection are implemented in Node. Some direct images load in an `<img>`, but drawing them into the Cesium projection canvas taints it without CORS. Pages cannot serve the image proxy. Static builds now reject camera activation explicitly instead of displaying synthetic seed cameras as live monitoring. |
| Civil/military flights, vessels, transit, live traffic, installations, routing, FIRMS | **Requires API server** | The client calls same-origin `/api/*` routes; some feeds additionally require private provider keys or a server-side rate limiter/cache. |
| Provider settings, Google Places, AI summary/voice | **Requires API server and keys** | Keys must stay server-side. Pages has neither a server process nor a secret store accessible to client requests. |

## What was verified

- The deployed site returns missing-route responses for `/api/*` requests.
- CelesTrak, Launch Library 2, Radio Browser and sampled GBFS endpoints allowed
  browser-origin requests from `https://anilatli.github.io` during this audit.
- The Austin public camera catalog allowed browser-origin requests, but a
  sample live image loaded only as a cross-origin image: exporting its canvas
  raised `SecurityError` (tainted canvas). Other camera providers have their
  own access rules and attribution requirements.
- Existing camera media code does not store or redistribute frames. Replacing
  it with periodically committed snapshots would alter the product and could
  violate provider terms, so the Pages edition does not do that.

## Full-feature deployment requirement

Keep GitHub Pages for the frontend, but run the repository's existing Node
provider middleware on a persistent HTTPS host and route `/api/*` calls to it.
Configure allowed CORS origin as `https://anilatli.github.io` and set the
required provider secrets on that host, never in the Pages build. The current
repository has no backend hosting account or API secrets attached; therefore
the public Pages URL cannot truthfully offer camera monitoring or all other
live features yet.
