// xp-system.js
window.XPSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null; // injected by save-system via init()

  function init(sharedState) {
    state = sharedState;
    state.xp = state.xp || 0;
    state.level = state.level || 1;
  }

  function add(amount, reason) {
    if (!state || amount <= 0) return;
    const before = window.ProgressionMath.levelForXP(state.xp);
    state.xp += amount;
    const after = window.ProgressionMath.levelForXP(state.xp);
    state.level = after.level;

    Events.emit("xp:gained", { amount, total: state.xp, reason });

    if (after.level > before.level) {
      for (let lvl = before.level + 1; lvl <= after.level; lvl++) {
        Events.emit("xp:levelup", { level: lvl });
        // Grant chest reward if this level has one
        const levelDef = (window.XP_LEVELS || []).find(l => l.level === lvl);
        if (levelDef && levelDef.chest && window.ChestSystem) {
          window.ChestSystem.addToInventory(levelDef.chest);
          Events.emit("chest:levelup_grant", { level: lvl, chestId: levelDef.chest });
        }
      }
    }
    Events.emit("progression:dirty");
  }

  function getProgress() {
    return window.ProgressionMath.levelForXP(state ? state.xp : 0);
  }

  return { init, add, earn: add, getProgress };
})();
