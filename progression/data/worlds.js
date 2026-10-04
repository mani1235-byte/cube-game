// data/worlds.js
// Each world now has real gameplay/visual settings consumed by script.js.
window.WORLDS = [
  { id: "grasslands", name: "Grasslands", order: 0, requirement: null, portalColor: "#5be36b", portalModel: null, targetColors: ["#67d7f0", "#a6e02c", "#fe9522"], speedMult: 1.00, spawnMult: 1.00, gravityMult: 1.00, backgroundClass: "world-grasslands" },
  { id: "desert", name: "Desert", order: 1, requirement: { type: "trophies", value: 500 }, portalColor: "#e3b04b", portalModel: "progression/assets/models/portals/portal_easy.glb", targetColors: ["#ffd166", "#f4a261", "#e9c46a"], speedMult: 1.05, spawnMult: 0.96, gravityMult: 0.92, backgroundClass: "world-desert" },
  { id: "volcano", name: "Volcano", order: 2, requirement: { type: "rewardId", value: "world_volcano" }, portalColor: "#ff5a3c", portalModel: "progression/assets/models/portals/portal_hard.glb", targetColors: ["#ff5a3c", "#ff8c42", "#ffd166"], speedMult: 1.14, spawnMult: 0.84, gravityMult: 1.10, backgroundClass: "world-volcano" },
  { id: "glacier", name: "Glacier", order: 3, requirement: { type: "rewardId", value: "world_glacier" }, portalColor: "#9fe8ff", portalModel: "progression/assets/models/portals/portal_extreme.glb", targetColors: ["#9fe8ff", "#67d7f0", "#d9f7ff"], speedMult: 0.96, spawnMult: 0.72, gravityMult: 0.86, backgroundClass: "world-glacier" }
];
