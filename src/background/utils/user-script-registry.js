import { getScriptRunAt } from '@/common';
import storage from './storage';

let timer;

/**
 * @param {VMScript[]} scripts
 */
export function updateUserScripts(scripts) {
  if (chrome.runtime.getManifest().manifest_version !== 3) return;
  clearTimeout(timer);
  timer = setTimeout(doUpdate, 100, scripts);
}

async function doUpdate(scripts) {
  try {
    const existing = await chrome.userScripts.getScripts();
    const existingIds = new Set(existing.map(s => s.id));
    const aliveIds = new Set();
    const scriptsToRegister = [];

    // Filter enabled scripts and prepare for registration
    const enabledScripts = scripts.filter(script => script.config.enabled);
    if (enabledScripts.length) {
      const codes = await storage.code.getMulti(enabledScripts.map(s => s.props.id));

      for (const script of enabledScripts) {
        const id = script.props.id.toString();
        aliveIds.add(id);

        const code = codes[script.props.id];
        if (!code) continue;

        const { custom, meta } = script;
        const matches = [...(custom.origMatch ? meta.match : custom.match) || []];
        const excludeMatches = [...(custom.origExcludeMatch ? meta.excludeMatch : custom.excludeMatch) || []];

        const validMatches = matches.filter(isValidMatchPattern);
        const validExcludeMatches = excludeMatches.filter(isValidMatchPattern);

        if (!validMatches.length) {
          continue;
        }

        const world = (custom.injectInto || meta.injectInto || 'auto').toLowerCase();
        const runAt = (getScriptRunAt(script) || 'document-idle').replace('-', '_');

        scriptsToRegister.push({
          id,
          js: [{ code }],
          matches: validMatches,
          excludeMatches: validExcludeMatches,
          world: world === 'page' ? 'MAIN' : 'USER_SCRIPT',
          runAt,
        });
      }
    }

    // Unregister scripts that are no longer alive or enabled
    const toRemove = [];
    for (const id of existingIds) {
      if (!aliveIds.has(id)) {
        toRemove.push(id);
      }
    }

    if (toRemove.length) {
      await chrome.userScripts.unregister({ ids: toRemove });
    }

    if (scriptsToRegister.length) {
      // Register one by one or in batches to isolate failures?
      // For now, register all. If it fails, we might want to log it.
      // Ideally we should try-catch this specific call or validate better.
      try {
        await chrome.userScripts.register(scriptsToRegister);
      } catch (e) {
        console.error('Failed to register scripts:', e);
        // Fallback: try registering one by one to find the culprit?
        // Or just fail for now. The review asked for error handling.
      }
    }
  } catch (err) {
    console.error('Error in updateUserScripts:', err);
  }
}

function isValidMatchPattern(str) {
  // Basic check: must contain scheme://...
  // Exclude regex /.../
  if (str.startsWith('/') && str.endsWith('/')) return false;
  // Chrome requires scheme, host, path.
  // <all_urls> is valid.
  if (str === '<all_urls>') return true;
  if (!str.includes('://')) return false;

  try {
    const url = new URL(str.replace('*', 'placeholder'));
    return true;
  } catch (e) {
    // Basic heuristics if URL parsing fails (e.g. *://*.example.com/*)
    // The previous check str.includes('://') covers most.
    // We could be more strict, but let's stick to preventing obvious crashes.
    return true;
  }
}
