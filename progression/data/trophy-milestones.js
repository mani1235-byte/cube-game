// data/trophy-milestones.js
// Trophy-count milestones. Reworked so all chest rarities are reachable
// at realistic trophy counts — Silver at 50, Gold at 200, Crystal at 500,
// Legendary at 1500 (not 10,000).
window.TROPHY_MILESTONES = [
  { trophies: 10,   id: "t_10",   tier: "bronze",  rewardId: "coins_small"      },
  { trophies: 25,   id: "t_25",   tier: "bronze",  rewardId: "chest_wooden"     },
  { trophies: 50,   id: "t_50",   tier: "silver",  rewardId: "chest_silver"     },  // ← was coins_medium
  { trophies: 100,  id: "t_100",  tier: "silver",  rewardId: "trophy_silver"    },
  { trophies: 200,  id: "t_200",  tier: "silver",  rewardId: "chest_gold"       },  // ← was 2000 trophies!
  { trophies: 350,  id: "t_350",  tier: "gold",    rewardId: "world_desert"     },
  { trophies: 500,  id: "t_500",  tier: "gold",    rewardId: "chest_crystal"    },  // ← brand new
  { trophies: 750,  id: "t_750",  tier: "gold",    rewardId: "trophy_gold"      },
  { trophies: 1000, id: "t_1000", tier: "gold",    rewardId: "chest_gold"       },
  { trophies: 1500, id: "t_1500", tier: "diamond", rewardId: "chest_legendary"  },  // ← was 10,000!
  { trophies: 2500, id: "t_2500", tier: "diamond", rewardId: "difficulty_hard"  },
  { trophies: 4000, id: "t_4000", tier: "diamond", rewardId: "trophy_diamond"   },
  { trophies: 6000, id: "t_6000", tier: "diamond", rewardId: "chest_legendary"  },
  { trophies: 10000,id: "t_10000",tier: "diamond", rewardId: "chest_legendary"  },
];
