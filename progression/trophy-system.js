// trophy-system.js
window.TrophySystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.trophies = state.trophies || 0;
    state.trophyMilestonesClaimed = state.trophyMilestonesClaimed || {};
    state.trophyCase = state.trophyCase || []; // unlocked trophy models e.g. "silver"
  }

  function add(amount) {
    if (!state || amount <= 0) return;
    state.trophies += amount;
    Events.emit("trophies:gained", { amount, total: state.trophies });
    checkMilestones();
    Events.emit("progression:dirty");
  }

  function checkMilestones() {
    (window.TROPHY_MILESTONES || []).forEach(m => {
      if (state.trophies >= m.trophies && !state.trophyMilestonesClaimed[m.id]) {
        // stored as an object (not bare `true`) so the 3D Trophy Hall can show
        // a "date unlocked" — still truthy, so existing checks above keep working.
        state.trophyMilestonesClaimed[m.id] = { at: Date.now() };
        Events.emit("trophies:milestone", m);
        if (window.RewardSystem) window.RewardSystem.grant(m.rewardId, { source: "trophy_milestone", milestone: m.id });
      }
    });
  }

  function addToCase(trophyId) {
    if (!state.trophyCase.includes(trophyId)) {
      state.trophyCase.push(trophyId);
      state.trophyCaseDates = state.trophyCaseDates || {};
      state.trophyCaseDates[trophyId] = Date.now();
      Events.emit("trophies:case_updated", state.trophyCase.slice());
    }
  }

  return { init, add, addToCase, checkMilestones };
})();
