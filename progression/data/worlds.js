// data/worlds.js
window.WORLDS = [
  { id: "grasslands", name: "Grasslands", order: 0, requirement: null, portalColor: "#5be36b", portalModel: null },
  { id: "desert",     name: "Desert",     order: 1, requirement: { type: "trophies", value: 500 },  portalColor: "#e3b04b", portalModel: "progression/assets/models/portals/portal_easy.glb" },
  { id: "volcano",    name: "Volcano",    order: 2, requirement: { type: "rewardId", value: "world_volcano" }, portalColor: "#ff5a3c", portalModel: "progression/assets/models/portals/portal_hard.glb" },
  { id: "glacier",    name: "Glacier",    order: 3, requirement: { type: "rewardId", value: "world_glacier" }, portalColor: "#9fe8ff", portalModel: "progression/assets/models/portals/portal_extreme.glb" }
];
