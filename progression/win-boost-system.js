// win-boost-system.js
// Three-day win reward boost: Day 1 = 2x, Day 2 = 4x, Day 3 = 8x, then it expires.
// Stored in the per-account progression save.
window.WinBoostSystem = (function () {
  const Events = window.ProgressionEvents;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MULTIPLIERS = [2, 4, 8];
  let state = null;
  let activeMultiplier = 1;

  function dateKey(timestamp) {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dayNumberFromDates(startKey, nowKey) {
    if (!startKey || !nowKey) return 0;
    const start = new Date(startKey + "T00:00:00");
    const now = new Date(nowKey + "T00:00:00");
    return Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1;
  }

  function init(sharedState) {
    state = sharedState;
    state.winBoost = state.winBoost || { startedOn: null, lastWinAt: null };
    activeMultiplier = 1;
    refresh();
  }

  function refresh() {
    if (!state || !state.winBoost || !state.winBoost.startedOn) {
      activeMultiplier = 1;
      return getStatus();
    }
    const day = dayNumberFromDates(state.winBoost.startedOn, dateKey(Date.now()));
    activeMultiplier = (day >= 1 && day <= 3) ? MULTIPLIERS[day - 1] : 1;
    return getStatus();
  }

  function beginWin() {
    if (!state) return getStatus();
    const now = Date.now();
    if (!state.winBoost.startedOn) state.winBoost.startedOn = dateKey(now);
    state.winBoost.lastWinAt = now;
    refresh();
    Events.emit("winBoost:updated", getStatus());
    Events.emit("progression:dirty");
    return getStatus();
  }

  function getMultiplier() {
    refresh();
    return activeMultiplier;
  }

  function getStatus() {
    const wb = state && state.winBoost ? state.winBoost : {};
    const day = wb.startedOn ? dayNumberFromDates(wb.startedOn, dateKey(Date.now())) : 0;
    return {
      day: day >= 1 && day <= 3 ? day : 0,
      multiplier: (day >= 1 && day <= 3) ? MULTIPLIERS[day - 1] : 1,
      active: day >= 1 && day <= 3,
      startedOn: wb.startedOn || null,
      lastWinAt: wb.lastWinAt || null
    };
  }

  function multiply(amount) {
    return Math.floor((Number(amount) || 0) * getMultiplier());
  }

  return { init, beginWin, getMultiplier, getStatus, multiply };
})();
