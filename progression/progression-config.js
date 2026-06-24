// progression-config.js
// All "magic numbers" for the progression system live here so designers
// can tune balance without touching system logic.
window.ProgressionConfig = {
  storageKey: "cg_progression_v1",
  autoSaveDebounceMs: 800,

  xp: {
    perWin: 25,
    dailyLoginBonus: 50
  },

  trophies: {
    // how match score converts into trophies at game-over (CGTrophies bridge)
    scoreToTrophyRatio: 50 // 1 trophy per 50 score
  },

  coins: {
    perWin: 10,
    chestOpenSoundDelayMs: 250
  },

  chests: {
    // how many in-game minutes between a free chest spawning in the world
    spawnIntervalMs: 4 * 60 * 1000,
    maxQueued: 5
  },

  ui: {
    toastDurationMs: 3200,
    xpBarAnimMs: 600
  }
};
