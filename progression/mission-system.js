// mission-system.js
// Replaces the old passive chest-spawn timer: chests/rewards now only come
// from completing a mission (or from the XP/trophy/level milestone roads,
// which already existed). Mirrors trophy-system.js's checkMilestones()
// pattern, but progress comes from a handful of lifetime stats this file
// owns (games played, best score, lifetime score) plus chestsOpened, which
// chest-system.js already tracks.
window.MissionSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.missionsClaimed = state.missionsClaimed || {};
    state.missionStats = state.missionStats || { gamesPlayed: 0, bestScore: 0, scoreLifetime: 0 };
  }

  // Call once per match, right when it ends.
  function recordMatch(score) {
    if (!state) return;
    score = score || 0;
    state.missionStats.gamesPlayed++;
    state.missionStats.scoreLifetime += score;
    if (score > state.missionStats.bestScore) state.missionStats.bestScore = score;
    checkMissions();
    Events.emit("progression:dirty");
  }

  function getStat(type) {
    switch (type) {
      case "gamesPlayed":   return state.missionStats.gamesPlayed;
      case "bestScore":     return state.missionStats.bestScore;
      case "scoreLifetime": return state.missionStats.scoreLifetime;
      case "chestsOpened":  return state.chestsOpened || 0;
      default:              return 0;
    }
  }

  function checkMissions() {
    if (!state) return;
    const completed = [];
    (window.MISSIONS || []).forEach(m => {
      if (state.missionsClaimed[m.id]) return;
      if (getStat(m.type) >= m.target) {
        state.missionsClaimed[m.id] = { at: Date.now() };
        completed.push(m);
        Events.emit("mission:completed", m);
        if (window.RewardSystem) window.RewardSystem.grant(m.rewardId, { source: "mission", mission: m.id });
      }
    });
    return completed;
  }

  return { init, recordMatch, checkMissions, getStat };
})();
