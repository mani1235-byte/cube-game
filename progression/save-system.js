// save-system.js
// Owns the single shared state object + its persistence to localStorage.
// Every other system receives this same object reference via init(state)
// so mutations anywhere are automatically visible everywhere.
//
// IMPORTANT: progression is stored PER ACCOUNT. The storage key is namespaced
// with whoever is currently signed in (see window.CGAccount.currentKey()), so
// switching accounts on the same device never leaks trophies/XP/battle-pass
// progress from one account into another — a fresh/different account always
// starts at 0. A one-time migration copies any old un-scoped save into the
// very first account that loads after this change, so nobody's current
// progress is silently wiped by the fix.
window.SaveSystem = (function () {
  const Events = window.ProgressionEvents;
  const LEGACY_KEY = "cg_progression_v1"; // pre-namespacing shared key
  let state = null;
  let saveHandle = null;

  function scopedKey() {
    const base = window.ProgressionConfig.storageKey;
    const who  = (window.CGAccount && window.CGAccount.currentKey) ? window.CGAccount.currentKey() : "anon";
    return base + ":" + who;
  }

  function load() {
    const key = scopedKey();
    let raw = localStorage.getItem(key);

    // One-time migration: if this account has no scoped save yet but an old
    // shared/global save exists, adopt it once, then remove the legacy key
    // so it can't leak into any other account later.
    if (raw === null) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        raw = legacy;
        try { localStorage.setItem(key, legacy); } catch (_) {}
        try { localStorage.removeItem(LEGACY_KEY); } catch (_) {}
      }
    }

    let parsed = {};
    try { parsed = JSON.parse(raw || "{}"); } catch (_) { parsed = {}; }
    state = parsed;
    return state;
  }

  function persist() {
    const key = scopedKey();
    try { localStorage.setItem(key, JSON.stringify(state)); } catch (err) { console.error("[SaveSystem] save failed:", err); }
    Events.emit("progression:saved", null);
  }

  function scheduleSave() {
    clearTimeout(saveHandle);
    saveHandle = setTimeout(persist, window.ProgressionConfig.autoSaveDebounceMs);
  }

  function getState() { return state; }

  function reset() {
    state = {};
    persist();
    Events.emit("progression:reset", null);
  }

  // auto-save whenever any subsystem reports a change
  Events.on("progression:dirty", scheduleSave);

  return { load, persist, scheduleSave, getState, reset };
})();
