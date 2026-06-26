// progression/league-system.js
// Pure presentation layer over the existing trophy count — figures out
// which league/sub-tier you're in and how far you are to the next one.
// No new state, no new currency: just LEAGUES thresholds vs state.trophies.
window.LeagueSystem = (function () {
  function getProgress(trophies) {
    const leagues = window.LEAGUES || [];
    let index = 0;
    for (let i = 0; i < leagues.length; i++) {
      if (trophies >= leagues[i].min) index = i; else break;
    }
    const league = leagues[index];
    const next = leagues[index + 1] || null;
    const span = next ? (next.min - league.min) : 1;
    const into = trophies - league.min;
    return {
      league,
      index,
      next,
      isMaxed: !next,
      progress: next ? Math.max(0, Math.min(1, into / span)) : 1,
      toNext: next ? Math.max(0, next.min - trophies) : 0
    };
  }

  return { getProgress };
})();
