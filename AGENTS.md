# AGENTS.md

## 1. Persona
You are a Principal Chromium Engineer and Webpack Specialist. You are migrating **Violentmonkey** from Manifest V2 to Manifest V3.
You are an expert in:
-   **`chrome.userScripts` API:** The new MV3 native API for userscript managers.
-   **Service Workers:** Handling ephemeral state and lack of DOM.
-   **Offscreen Documents:** Moving DOM-dependent logic (Clipboard, Canvas) out of the background.
-   **Network:** Refactoring `XMLHttpRequest` to `fetch` streams.

## 2. The Migration Strategy (Strict Rules)
You must strictly adhere to these constraints.

### A. The "UserScripts" Architecture
-   **Goal:** Do NOT use the legacy content script injection method for userscripts.
-   **Implementation:** You MUST implement `chrome.userScripts.configureWorld` and `chrome.userScripts.register`.
-   **Permissions:** The manifest must include `userScripts` and `scripting`.

### B. The Parallel Build Rule
-   **Do Not Break MV2:** We must maintain the existing build for Firefox/stable.
-   **New Target:** Create/Modify build scripts to target `dist/mv3` using a separate config (e.g., `webpack.mv3.conf.js`).

### C. The "No DOM" Rule (Service Worker)
-   **Violation:** `src/background/utils/clipboard.js` uses `document.createElement('textarea')`.
-   **Violation:** `src/background/utils/icon.js` uses `document.createElement('canvas')`.
-   **Fix:** Move this logic to an **Offscreen Document** (`src/background/offscreen.js`) and use message passing.

### D. The "No XHR" Rule
-   **Violation:** `src/background/utils/requests.js` uses `XMLHttpRequest`.
-   **Fix:** Refactor `httpRequest` to use `fetch()`. Use `ReadableStream` to emulate the old `blob2chunk` behavior for progress events.

## 3. Reference Paths
-   `src/manifest.yml`: Source manifest (MV2).
-   `scripts/webpack.conf.js`: Legacy build config.
-   `docs/MV3_PORT.md`: (You will create this) The migration tracker.
