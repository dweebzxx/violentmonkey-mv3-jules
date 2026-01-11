# Manifest V3 Migration Tracker

## Strategy
We are migrating Violentmonkey to Manifest V3 (MV3) using a hybrid approach:
1.  **Parallel Build:** We will maintain `dist/mv3` separately from the legacy build.
2.  **Native UserScripts:** We will use `chrome.userScripts` (API) instead of content script injection.
3.  **Service Worker:** We will replace the background page with a Service Worker.

## Blockers & Status

| ID | Component | Status | Issue | Fix Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **B01** | **Build System** | 🔴 Pending | `webpack.conf.js` targets MV2 background pages. | Create `webpack.mv3.conf.js` targeting `service_worker.js`. |
| **B02** | **Manifest** | 🔴 Pending | `src/manifest.yml` uses `background.scripts` and `webRequestBlocking`. | Update manifest helper to generate MV3 schema with `userScripts` permission. |
| **B03** | **Network** | 🔴 Pending | `src/background/utils/requests.js` uses `XMLHttpRequest` (forbidden in SW). | Refactor to `fetch()` with `ReadableStream`. |
| **B04** | **DOM Access** | 🔴 Pending | `clipboard.js` uses `textarea`; `icon.js` uses `canvas`. | Move logic to Offscreen Document (`offscreen.html`). |
| **B05** | **Injection** | 🔴 Pending | Legacy content script injection is brittle in MV3. | Implement `chrome.userScripts.register`. |

## Migration Log
- [Date] Phase 1: Audit complete. Blockers identified.
