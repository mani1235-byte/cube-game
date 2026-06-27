// progression-manager.js
// Main controller: boots subsystems in dependency order, wires
// cross-system event reactions, and exposes the public API the rest of
// the game (and the UI layer) calls into.
window.ProgressionManager = (function () {
  const Events = window.ProgressionEvents;
  let state = null;
  let booted = false;

  function init() {
    if (booted) return;
    booted = true;

    state = window.SaveSystem.load();

    // every subsystem shares the same state object reference
    window.XPSystem.init(state);
    window.TrophySystem.init(state);
    window.LevelMilestoneSystem.init(state);
    window.CoinSystem.init(state);
    window.RewardSystem.init(state);
    window.ChestSystem.init(state);
    window.WorldSystem.init(state);
    window.DifficultySystem.init(state);
    window.PassSystem.init(state);
    window.MissionSystem.init(state);
    window.WeeklyMissionSystem.init(state);

    wireAchievements();
    wireRecheck();

    // Chests no longer spawn passively on a timer — they're earned by
    // completing missions (see mission-system.js / data/missions.js),
    // same as XP/trophy/level rewards. ChestSystem.startSpawnLoop() is
    // intentionally not called.
    window.LevelMilestoneSystem.checkMilestones(); // claims level 1 immediately on first load
    window.MissionSystem.checkMissions(); // claims any already-met missions on first load
    window.WeeklyMissionSystem.ensureCurrentWeek(); // rolls a fresh weekly set if the stored one is from a past week
    window.WeeklyMissionSystem.checkMissions();
    Events.emit("progression:ready", state);
  }

  function wireAchievements() {
    const claimed = (state.achievementsClaimed = state.achievementsClaimed || {});
    Events.on("achievement:check", (id) => {
      if (claimed[id]) return;
      const def = (window.ACHIEVEMENTS || []).find(a => a.id === id);
      if (!def) return;
      claimed[id] = true;
      state.achievementDates = state.achievementDates || {};
      state.achievementDates[id] = Date.now();
      Events.emit("achievement:unlocked", def);
      window.RewardSystem.grant(def.rewardId, { source: "achievement", id });
    });

    Events.on("xp:levelup", ({ level }) => {
      if (level === 10) Events.emit("achievement:check", "level_10");
      if (level === 20) Events.emit("achievement:check", "level_20");
    });
    Events.on("trophies:gained", () => {
      if (state.trophies >= 1000) Events.emit("achievement:check", "trophy_1000");
    });
  }

  function wireRecheck() {
    // some world/difficulty requirements are trophy thresholds rather than
    // explicit reward grants — recheck them whenever trophies change
    Events.on("trophies:gained", () => {
      window.WorldSystem.recheck();
      window.DifficultySystem.recheck();
    });
    Events.on("xp:levelup", () => window.LevelMilestoneSystem.checkMilestones());
  }

  // ---- public convenience API -------------------------------------------
  function recordWin({ trophies = 0 } = {}) {
    window.XPSystem.add(window.ProgressionConfig.xp.perWin, "win");
    window.CoinSystem.earn(window.ProgressionConfig.coins.perWin, "win");
    if (trophies > 0) window.TrophySystem.add(trophies);
  }

  function getSnapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  return { init, recordWin, getSnapshot, getState: () => state };
})();
