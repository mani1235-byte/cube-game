// world-system.js
window.WorldSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.unlockedWorlds = state.unlockedWorlds || (window.WORLDS || []).filter(w => !w.requirement).map(w => w.id);
    state.currentWorld = state.currentWorld || state.unlockedWorlds[0] || "grasslands";
  }

  function unlock(worldId) {
    if (state.unlockedWorlds.includes(worldId)) return;
    state.unlockedWorlds.push(worldId);
    Events.emit("world:unlocked", { worldId });
    Events.emit("achievement:check", "first_world");
    Events.emit("progression:dirty");
  }

  function isUnlocked(worldId) { return state.unlockedWorlds.includes(worldId); }

  function travelTo(worldId) {
    if (!isUnlocked(worldId)) return false;
    state.currentWorld = worldId;
    Events.emit("world:travel", { worldId });
    Events.emit("progression:dirty");
    return true;
  }

  // Re-check requirement-based worlds against current stats (called after
  // trophy/xp/reward changes in case a requirement was already satisfied
  // by something other than the reward path, e.g. trophies threshold).
  function recheck() {
    (window.WORLDS || []).forEach(w => {
      if (isUnlocked(w.id) || !w.requirement) return;
      if (w.requirement.type === "trophies" && state.trophies >= w.requirement.value) unlock(w.id);
    });
  }

  return { init, unlock, isUnlocked, travelTo, recheck };
})();
