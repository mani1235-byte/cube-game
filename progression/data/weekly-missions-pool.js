// data/weekly-missions-pool.js
// Templates that weekly-mission-system.js picks from every time the week
// rolls over. Unlike the permanent list in data/missions.js, these track a
// stat that resets every week (see weekly-mission-system.js getStat()), and
// each refresh randomly rolls a target + reward from the lists below so the
// weekly set isn't identical every time.
window.WEEKLY_MISSION_POOL = [
  {
    type: "gamesPlayedWeek",
    labelTemplate: "Play {target} matches this week",
    targets: [5, 10, 15, 20],
    rewards: ["chest_wooden", "chest_silver", "chest_gold"]
  },
  {
    type: "scoreWeek",
    labelTemplate: "Earn {target} total score this week",
    targets: [3000, 6000, 12000, 20000],
    rewards: ["chest_silver", "chest_gold", "chest_crystal"]
  },
  {
    type: "bestScoreWeek",
    labelTemplate: "Score {target}+ in a single match this week",
    targets: [800, 1500, 3000, 5000],
    rewards: ["chest_wooden", "chest_silver", "chest_gold"]
  },
  {
    type: "chestsOpenedWeek",
    labelTemplate: "Open {target} chests this week",
    targets: [2, 4, 6],
    rewards: ["xp_boost_medium", "skin_ice", "trail_stars", "chest_gold"]
  },
  {
    type: "trophiesWeek",
    labelTemplate: "Earn {target} trophies this week",
    targets: [50, 100, 200],
    rewards: ["chest_silver", "chest_gold", "trophy_silver"]
  }
];

// How many missions are active at once each week.
window.WEEKLY_MISSION_COUNT = 4;
