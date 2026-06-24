// data/xp-levels.js
// Raw XP curve data. Pure data, no logic — progression-math.js consumes this.
window.XP_LEVELS = [
  { level: 1,  xpRequired: 0 },
  { level: 2,  xpRequired: 100 },
  { level: 3,  xpRequired: 250 },
  { level: 4,  xpRequired: 500 },
  { level: 5,  xpRequired: 900 },
  { level: 6,  xpRequired: 1400 },
  { level: 7,  xpRequired: 2000 },
  { level: 8,  xpRequired: 2700 },
  { level: 9,  xpRequired: 3500 },
  { level: 10, xpRequired: 4500, title: "Cube Veteran" },
  { level: 12, xpRequired: 6800 },
  { level: 14, xpRequired: 9600 },
  { level: 16, xpRequired: 13000 },
  { level: 18, xpRequired: 17000 },
  { level: 20, xpRequired: 21500, title: "Cube Master" },
  { level: 25, xpRequired: 34000 },
  { level: 30, xpRequired: 50000, title: "Cube Legend" }
];

// Beyond the last explicit entry, level requirement grows by this formula
// (used by progression-math.js#xpForLevel for procedurally generated levels).
window.XP_CURVE_TAIL = {
  baseLevel: 30,
  baseXP: 50000,
  perLevel: 4500,
  growth: 1.04 // each level costs 4% more than the flat perLevel amount
};
