// data/chest-table.js
// Chest rarity definitions + their loot tables (weighted random pools).
// modelPath points at the .glb that would be used if/when a real 3D
// renderer (three.js) is wired in; today these are drawn via canvas
// in three/chest-model.js as a stand-in.
window.CHEST_TABLE = {
  wooden: {
    id: "wooden", name: "Wooden Chest", rarity: 1,
    color: "#8b5a2b", glow: "#c98a4b",
    modelPath: "progression/assets/models/chests/wooden.glb",
    openTimeMs: 1200,
    loot: [
      { type: "coins", min: 20,  max: 60,  weight: 70 },
      { type: "coins", min: 60,  max: 120, weight: 25 },
      { type: "chestUpgrade", to: "silver", weight: 5 }
    ]
  },
  silver: {
    id: "silver", name: "Silver Chest", rarity: 2,
    color: "#b9c2cc", glow: "#e3eaf2",
    modelPath: "progression/assets/models/chests/silver.glb",
    openTimeMs: 1600,
    loot: [
      { type: "coins", min: 80,  max: 180, weight: 55 },
      { type: "coins", min: 180, max: 320, weight: 30 },
      { type: "rewardId", rewardId: "trophy_silver", weight: 10 },
      { type: "chestUpgrade", to: "gold", weight: 5 }
    ]
  },
  gold: {
    id: "gold", name: "Gold Chest", rarity: 3,
    color: "#ffd24a", glow: "#fff3b0",
    modelPath: "progression/assets/models/chests/gold.glb",
    openTimeMs: 2000,
    loot: [
      { type: "coins", min: 250, max: 500, weight: 50 },
      { type: "coins", min: 500, max: 900, weight: 25 },
      { type: "rewardId", rewardId: "trophy_gold", weight: 15 },
      { type: "chestUpgrade", to: "crystal", weight: 10 }
    ]
  },
  crystal: {
    id: "crystal", name: "Crystal Chest", rarity: 4,
    color: "#7ad8ff", glow: "#d8f6ff",
    modelPath: "progression/assets/models/chests/crystal.glb",
    openTimeMs: 2400,
    loot: [
      { type: "coins", min: 600,  max: 1200, weight: 45 },
      { type: "rewardId", rewardId: "cosmetic_speed", weight: 25 },
      { type: "rewardId", rewardId: "world_volcano", weight: 15 },
      { type: "chestUpgrade", to: "legendary", weight: 15 }
    ]
  },
  legendary: {
    id: "legendary", name: "Legendary Chest", rarity: 5,
    color: "#ff5fd1", glow: "#ffe0fa",
    modelPath: "progression/assets/models/chests/legendary.glb",
    openTimeMs: 3000,
    loot: [
      { type: "coins", min: 1500, max: 3000, weight: 50 },
      { type: "rewardId", rewardId: "trophy_diamond", weight: 20 },
      { type: "rewardId", rewardId: "difficulty_extreme", weight: 15 },
      { type: "rewardId", rewardId: "world_glacier", weight: 15 }
    ]
  }
};

window.CHEST_ORDER = ["wooden", "silver", "gold", "crystal", "legendary"];
