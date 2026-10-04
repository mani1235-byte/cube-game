// data/difficulties.js
// Gameplay modifiers are consumed by script.js when a match starts/spawns.
window.DIFFICULTIES = [
  { id: "easy",    name: "Easy",    order: 0, requirement: null, speedMult: 0.82, spawnMult: 1.28, healthBonus: 0, bombMult: 0.45, scoreMult: 0.85 },
  { id: "normal",  name: "Normal",  order: 1, requirement: null, speedMult: 1.00, spawnMult: 1.00, healthBonus: 0, bombMult: 1.00, scoreMult: 1.00 },
  { id: "hard",    name: "Hard",    order: 2, requirement: { type: "trophies", value: 2000 }, speedMult: 1.25, spawnMult: 0.78, healthBonus: 1, bombMult: 1.25, scoreMult: 1.60 },
  { id: "extreme", name: "Extreme", order: 3, requirement: { type: "rewardId", value: "difficulty_extreme" }, speedMult: 1.55, spawnMult: 0.62, healthBonus: 1, bombMult: 1.55, scoreMult: 2.50 }
];
