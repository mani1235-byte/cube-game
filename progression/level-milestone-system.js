// level-milestone-system.js
// Same pattern as trophy-system.js's checkMilestones(), but keyed off
// player LEVEL (window.LEVEL_MILESTONES) instead of trophy count. Gets
// rechecked any time the player levels up — see progression-manager.js.
window.LevelMilestoneSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.levelMilestonesClaimed = state.levelMilestonesClaimed || {};
  }

  function checkMilestones() {
    if (!state) return;
    (window.LEVEL_MILESTONES || []).forEach(m => {
      if (state.level >= m.level && !state.levelMilestonesClaimed[m.id]) {
        // stored as an object (not bare `true`) so the 3D Trophy Hall can show
        // a "date unlocked", same convention as trophyMilestonesClaimed.
        state.levelMilestonesClaimed[m.id] = { at: Date.now() };
        Events.emit("level:milestone", m);
        if (window.RewardSystem) window.RewardSystem.grant(m.rewardId, { source: "level_milestone", milestone: m.id });
      }
    });
  }

  return { init, checkMilestones };
})();
