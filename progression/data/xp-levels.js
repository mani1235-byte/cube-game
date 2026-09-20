// data/xp-levels.js
// XP curve + level-up chest rewards. Every few levels gives a chest —
// Silver from level 3, Gold from level 8, Crystal from level 15,
// Legendary at 25+ — so players earn all rarities through normal play.
window.XP_LEVELS = [
  { level: 1,  xpRequired: 0 },
  { level: 2,  xpRequired: 100,   chest: "wooden"    },
  { level: 3,  xpRequired: 250,   chest: "silver"    },
  { level: 4,  xpRequired: 500 },
  { level: 5,  xpRequired: 900,   chest: "silver"    },
  { level: 6,  xpRequired: 1400 },
  { level: 7,  xpRequired: 2000,  chest: "gold"      },
  { level: 8,  xpRequired: 2700 },
  { level: 9,  xpRequired: 3500,  chest: "gold"      },
  { level: 10, xpRequired: 4500,  chest: "crystal",  title: "Cube Veteran" },
  { level: 12, xpRequired: 6800,  chest: "gold"      },
  { level: 14, xpRequired: 9600,  chest: "crystal"   },
  { level: 16, xpRequired: 13000, chest: "gold"      },
  { level: 18, xpRequired: 17000, chest: "crystal"   },
  { level: 20, xpRequired: 21500, chest: "legendary", title: "Cube Master" },
  { level: 25, xpRequired: 34000, chest: "legendary" },
  { level: 30, xpRequired: 50000, chest: "legendary", title: "Cube Legend" },
];

window.XP_CURVE_TAIL = {
  baseLevel: 30,
  baseXP: 50000,
  perLevel: 4500,
  growth: 1.04
};
