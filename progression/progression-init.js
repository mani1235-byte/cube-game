// progression-init.js
// Bootstraps the whole progression stack once the DOM is ready, then wires
// the legacy globals (window.player, unlockReward) so older code paths
// (xp.js/trophies.js's addXP/addTrophies, script.js's unlockReward) keep
// working without modification.
(function () {
  function boot() {
    window.ProgressionManager.init();

    // keep the legacy `window.player` object (used by script.js) loosely in
    // sync with the new progression state for any code still reading it
    window.player = window.player || { xp: 0, level: 1, trophies: 0, rewards: [] };
    const state = window.ProgressionManager.getState();
    window.ProgressionEvents.on("xp:gained", () => {
      window.player.xp = state.xp;
      window.player.level = state.level;
    });
    window.ProgressionEvents.on("trophies:gained", () => {
      window.player.trophies = state.trophies;
    });
    window.ProgressionEvents.on("reward:granted", ({ rewardId }) => {
      if (!window.player.rewards.includes(rewardId)) window.player.rewards.push(rewardId);
      if (typeof window.applyRewardInGame === "function") window.applyRewardInGame(rewardId);
    });

    // back-compat shim for the old window.Progression API used elsewhere
    window.Progression = {
      addXP: (n) => window.XPSystem.add(n, "legacy"),
      addTrophies: (n) => window.TrophySystem.add(n),
      getState: () => window.ProgressionManager.getSnapshot()
    };

    if (typeof window.initProgressionUI === "function") window.initProgressionUI();
    if (typeof window.initProgressionScene === "function") window.initProgressionScene();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
