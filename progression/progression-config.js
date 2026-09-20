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
    // Free chest every 90 seconds of play (was 4 minutes — too long)
    spawnIntervalMs: 90 * 1000,
    maxQueued: 8
  },

  ui: {
    toastDurationMs: 3200,
    xpBarAnimMs: 600
  }
};
