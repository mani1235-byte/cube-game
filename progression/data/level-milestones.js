// data/level-milestones.js
// Level-based milestones — same idea as TROPHY_MILESTONES (data/trophy-milestones.js)
// but the threshold is player LEVEL instead of trophy count. First reward at
// level 1, then 5, 10, 20, 30, 50, 75, 100, each granting a reward pulled
// from REWARD_TABLE. Shown as their own pedestal path in the 3D Trophy Hall.
window.LEVEL_MILESTONES = [
  { level: 1,   id: "lvl_1",   tier: "bronze",  rewardId: "coins_small"   },
  { level: 5,   id: "lvl_5",   tier: "bronze",  rewardId: "chest_wooden"  },
  { level: 10,  id: "lvl_10",  tier: "silver",  rewardId: "chest_silver"  },
  { level: 20,  id: "lvl_20",  tier: "silver",  rewardId: "skin_neon"     },
  { level: 30,  id: "lvl_30",  tier: "gold",    rewardId: "chest_gold"    },
  { level: 50,  id: "lvl_50",  tier: "gold",    rewardId: "trail_plasma"  },
  { level: 75,  id: "lvl_75",  tier: "diamond", rewardId: "chest_crystal" },
  { level: 100, id: "lvl_100", tier: "diamond", rewardId: "chest_legendary" },
];
