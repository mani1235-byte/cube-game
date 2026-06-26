// data/missions.js
// One-time "missions" — the replacement for the old passive chest-spawn
// timer. Each mission tracks a simple lifetime stat (games played, best
// single-match score, lifetime score, chests opened) and grants a reward
// from REWARD_TABLE the moment its target is reached. Checked by
// mission-system.js, mainly right after a match ends.
window.MISSIONS = [
  // ── Games played ───────────────────────────────────────────────────────
  { id: "m_play_1",   type: "gamesPlayed",   target: 1,    label: "Play your first match",      rewardId: "coins_small"    },
  { id: "m_play_5",   type: "gamesPlayed",   target: 5,    label: "Play 5 matches",              rewardId: "chest_wooden"   },
  { id: "m_play_20",  type: "gamesPlayed",   target: 20,   label: "Play 20 matches",              rewardId: "chest_silver"  },
  { id: "m_play_50",  type: "gamesPlayed",   target: 50,   label: "Play 50 matches",              rewardId: "chest_gold"    },
  { id: "m_play_100", type: "gamesPlayed",   target: 100,  label: "Play 100 matches",             rewardId: "chest_crystal" },

  // ── Best score in a single match ────────────────────────────────────────
  { id: "m_score_500",  type: "bestScore",   target: 500,   label: "Score 500+ in one match",     rewardId: "chest_wooden"  },
  { id: "m_score_2000", type: "bestScore",   target: 2000,  label: "Score 2,000+ in one match",   rewardId: "chest_gold"    },
  { id: "m_score_5000", type: "bestScore",   target: 5000,  label: "Score 5,000+ in one match",   rewardId: "chest_crystal" },

  // ── Lifetime score across all matches ────────────────────────────────────
  { id: "m_lifetime_10000", type: "scoreLifetime", target: 10000, label: "Earn 10,000 lifetime score", rewardId: "chest_silver"   },
  { id: "m_lifetime_50000", type: "scoreLifetime", target: 50000, label: "Earn 50,000 lifetime score", rewardId: "chest_legendary"},

  // ── Chests opened ────────────────────────────────────────────────────────
  { id: "m_chests_5",  type: "chestsOpened", target: 5,  label: "Open 5 chests",  rewardId: "skin_ice"    },
  { id: "m_chests_15", type: "chestsOpened", target: 15, label: "Open 15 chests", rewardId: "trail_stars" },
];
