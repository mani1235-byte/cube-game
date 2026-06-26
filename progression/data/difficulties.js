// data/difficulties.js
window.DIFFICULTIES = [
  { id: "easy",    name: "Easy",    order: 0, requirement: null, speedMult: 1.0,  scoreMult: 1.0 },
  { id: "normal",  name: "Normal",  order: 1, requirement: null, speedMult: 1.2,  scoreMult: 1.25 },
  { id: "hard",    name: "Hard",    order: 2, requirement: { type: "trophies", value: 2000 }, speedMult: 1.5, scoreMult: 1.6 },
  { id: "extreme", name: "Extreme", order: 3, requirement: { type: "rewardId", value: "difficulty_extreme" }, speedMult: 2.0, scoreMult: 2.5 }
];
