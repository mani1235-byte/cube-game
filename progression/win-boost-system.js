// win-boost-system.js
// Weekend-only reward boost. No account-started timer is used.
// Saturday: 00:00-12:00 = 2x, 12:00-24:00 = 4x
// Sunday:   00:00-12:00 = 8x, 12:00-24:00 = 16x
window.WinBoostSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;
  let activeMultiplier = 1;

  function getWeekendStatus(now = new Date()) {
    const day = now.getDay(); // 0 Sunday, 6 Saturday
    const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    if (day === 6) return { day: 1, phase: hour < 12 ? 1 : 2, multiplier: hour < 12 ? 2 : 4 };
    if (day === 0) return { day: 2, phase: hour < 12 ? 1 : 2, multiplier: hour < 12 ? 8 : 16 };
    return { day: 0, phase: 0, multiplier: 1 };
  }

  function init(sharedState) {
    state = sharedState;
    // Remove the old persistent three-day boost state so it can never resume.
    if (state && state.winBoost) delete state.winBoost;
    activeMultiplier = 1;
    refresh();
  }

  function refresh() {
    const status = getWeekendStatus();
    activeMultiplier = status.multiplier;
    return getStatus();
  }

  function beginWin() {
    const status = refresh();
    Events.emit("winBoost:updated", status);
    return status;
  }

  function getMultiplier() {
    refresh();
    return activeMultiplier;
  }

  function getStatus() {
    const status = getWeekendStatus();
    return {
      day: status.day,
      phase: status.phase,
      multiplier: status.multiplier,
      active: status.multiplier > 1,
      weekend: status.multiplier > 1
    };
  }

  function multiply(amount) {
    return Math.floor((Number(amount) || 0) * getMultiplier());
  }

  return { init, beginWin, getMultiplier, getStatus, multiply, refresh };
})();
