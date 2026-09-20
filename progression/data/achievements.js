// data/achievements.js
// Misc one-off achievements, independent of the XP/trophy milestone tracks.
// progression-manager.js can check these against arbitrary game stats.
window.ACHIEVEMENTS = [
  { id: "first_chest",     name: "Treasure Hunter",  desc: "Open your first chest",        rewardId: "coins_small" },
  { id: "five_chests",     name: "Chest Collector",  desc: "Open 5 chests",                rewardId: "coins_medium" },
  { id: "first_world",     name: "World Traveler",   desc: "Unlock a new world",           rewardId: "coins_medium" },
  { id: "first_difficulty",name: "Risk Taker",       desc: "Unlock a harder difficulty",   rewardId: "coins_large" },
  { id: "level_10",        name: "Cube Veteran",     desc: "Reach level 10",               rewardId: "chest_silver" },
  { id: "level_20",        name: "Cube Master",      desc: "Reach level 20",               rewardId: "chest_gold" },
  { id: "trophy_1000",     name: "Trophy Hunter",    desc: "Earn 1000 trophies",           rewardId: "chest_crystal" }
];
