// difficulty-system.js
window.DifficultySystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.unlockedDifficulties = state.unlockedDifficulties || (window.DIFFICULTIES || []).filter(d => !d.requirement).map(d => d.id);
    state.currentDifficulty = state.currentDifficulty || state.unlockedDifficulties[0] || "easy";
  }

  function unlock(difficultyId) {
    if (state.unlockedDifficulties.includes(difficultyId)) return;
    state.unlockedDifficulties.push(difficultyId);
    Events.emit("difficulty:unlocked", { difficultyId });
    Events.emit("achievement:check", "first_difficulty");
    Events.emit("progression:dirty");
  }

  function isUnlocked(difficultyId) { return state.unlockedDifficulties.includes(difficultyId); }

  function select(difficultyId) {
    if (!isUnlocked(difficultyId)) return false;
    state.currentDifficulty = difficultyId;
    Events.emit("difficulty:selected", { difficultyId });
    Events.emit("progression:dirty");
    return true;
  }

  function recheck() {
    (window.DIFFICULTIES || []).forEach(d => {
      if (isUnlocked(d.id) || !d.requirement) return;
      if (d.requirement.type === "trophies" && state.trophies >= d.requirement.value) unlock(d.id);
    });
  }

  return { init, unlock, isUnlocked, select, recheck };
})();
