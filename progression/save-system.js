// save-system.js
// Owns the single shared state object + its persistence to localStorage.
// Every other system receives this same object reference via init(state)
// so mutations anywhere are automatically visible everywhere.
window.SaveSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;
  let saveHandle = null;

  function load() {
    const key = window.ProgressionConfig.storageKey;
    let parsed = {};
    try { parsed = JSON.parse(localStorage.getItem(key) || "{}"); } catch (_) { parsed = {}; }
    state = parsed;
    return state;
  }

  function persist() {
    const key = window.ProgressionConfig.storageKey;
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
