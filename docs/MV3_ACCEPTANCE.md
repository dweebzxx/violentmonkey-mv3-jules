# MV3 Acceptance Criteria

## 1. Build Integrity
- [ ] Command `yarn build:mv3` completes without errors.
- [ ] Output directory `dist/mv3` contains `manifest.json` (V3) and `service_worker.js`.

## 2. Service Worker Lifecycle
- [ ] Extension loads unpacked in Chrome (Developer Mode) without immediate errors.
- [ ] Service Worker starts successfully.
- [ ] Service Worker handles "Sleep" (30s inactivity) and "Wake" events without losing state (e.g., active requests).

## 3. Core Functionality
- [ ] **Script Injection:** A test script installed via the UI runs on a target page using the `chrome.userScripts` API.
- [ ] **Network Requests:** `GM_xmlhttpRequest` works for cross-origin fetches (replacing the old XHR logic).
- [ ] **Menu Commands:** Extension popup opens and communicates with the Service Worker.
