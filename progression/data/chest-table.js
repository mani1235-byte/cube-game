// data/chest-table.js
// Chest rarity definitions + their loot tables (weighted random pools).
window.CHEST_TABLE = {
  wooden: {
    id: "wooden", name: "Wooden Chest", rarity: 1,
    color: "#8b5a2b", glow: "#c98a4b",
    modelPath: "progression/assets/models/chests/wooden.glb",
    openTimeMs: 1200,
    loot: [
      { type: "coins",    min: 20,  max: 60,  weight: 35 },
      { type: "coins",    min: 60,  max: 120, weight: 20 },
      { type: "rewardId", rewardId: "xp_boost_small",   weight: 15 },
      { type: "rewardId", rewardId: "heart_refill",      weight: 12 },
      { type: "rewardId", rewardId: "trail_fire",        weight: 8  },
      { type: "rewardId", rewardId: "skin_fire",         weight: 5  },
      { type: "rewardId", rewardId: "emote_fire",        weight: 3  },
      { type: "chestUpgrade", to: "silver",              weight: 2  }
    ]
  },
  silver: {
    id: "silver", name: "Silver Chest", rarity: 2,
    color: "#b9c2cc", glow: "#e3eaf2",
    modelPath: "progression/assets/models/chests/silver.glb",
    openTimeMs: 1600,
    loot: [
      { type: "coins",    min: 80,  max: 180, weight: 25 },
      { type: "coins",    min: 180, max: 320, weight: 15 },
      { type: "rewardId", rewardId: "xp_boost_medium",   weight: 15 },
      { type: "rewardId", rewardId: "multiplier_2x",     weight: 12 },
      { type: "rewardId", rewardId: "heart_refill",      weight: 10 },
      { type: "rewardId", rewardId: "trophy_silver",     weight: 8  },
      { type: "rewardId", rewardId: "skin_ice",          weight: 5  },
      { type: "rewardId", rewardId: "trail_ice",         weight: 5  },
      { type: "rewardId", rewardId: "powerup_shield",    weight: 3  },
      { type: "rewardId", rewardId: "emote_cool",        weight: 2  },
      { type: "chestUpgrade", to: "gold",                weight: 2  }
    ]
  },
  gold: {
    id: "gold", name: "Gold Chest", rarity: 3,
    color: "#ffd24a", glow: "#fff3b0",
    modelPath: "progression/assets/models/chests/gold.glb",
    openTimeMs: 2000,
    loot: [
      { type: "coins",    min: 250, max: 500, weight: 20 },
      { type: "coins",    min: 500, max: 900, weight: 10 },
      { type: "rewardId", rewardId: "xp_boost_large",    weight: 15 },
      { type: "rewardId", rewardId: "multiplier_2x",     weight: 10 },
      { type: "rewardId", rewardId: "multiplier_3x",     weight: 8  },
      { type: "rewardId", rewardId: "trophy_gold",       weight: 8  },
      { type: "rewardId", rewardId: "skin_neon",         weight: 7  },
      { type: "rewardId", rewardId: "skin_golden",       weight: 6  },
      { type: "rewardId", rewardId: "trail_stars",       weight: 5  },
      { type: "rewardId", rewardId: "powerup_magnet",    weight: 4  },
      { type: "rewardId", rewardId: "heart_refill_full", weight: 4  },
      { type: "rewardId", rewardId: "title_destroyer",   weight: 2  },
      { type: "rewardId", rewardId: "emote_gg",          weight: 1  },
      { type: "chestUpgrade", to: "crystal",             weight: 2  }
    ]
  },
  crystal: {
    id: "crystal", name: "Crystal Chest", rarity: 4,
    color: "#7ad8ff", glow: "#d8f6ff",
    modelPath: "progression/assets/models/chests/crystal.glb",
    openTimeMs: 2400,
    loot: [
      { type: "coins",    min: 600,  max: 1200, weight: 15 },
      { type: "rewardId", rewardId: "xp_boost_mega",     weight: 12 },
      { type: "rewardId", rewardId: "multiplier_3x",     weight: 10 },
      { type: "rewardId", rewardId: "multiplier_5x",     weight: 8  },
      { type: "rewardId", rewardId: "skin_rainbow",      weight: 8  },
      { type: "rewardId", rewardId: "skin_galaxy",       weight: 7  },
      { type: "rewardId", rewardId: "trail_plasma",      weight: 7  },
      { type: "rewardId", rewardId: "trail_rainbow",     weight: 6  },
      { type: "rewardId", rewardId: "world_volcano",     weight: 6  },
      { type: "rewardId", rewardId: "powerup_slowmo",    weight: 5  },
      { type: "rewardId", rewardId: "powerup_frenzy",    weight: 5  },
      { type: "rewardId", rewardId: "difficulty_hard",   weight: 4  },
      { type: "rewardId", rewardId: "title_collector",   weight: 3  },
      { type: "rewardId", rewardId: "emote_crown",       weight: 2  },
      { type: "chestUpgrade", to: "legendary",           weight: 2  }
    ]
  },
  legendary: {
    id: "legendary", name: "Legendary Chest", rarity: 5,
    color: "#ff5fd1", glow: "#ffe0fa",
    modelPath: "progression/assets/models/chests/legendary.glb",
    openTimeMs: 3000,
    loot: [
      { type: "coins",    min: 1500, max: 3000, weight: 15 },
      { type: "rewardId", rewardId: "coins_mega",         weight: 10 },
      { type: "rewardId", rewardId: "xp_boost_mega",      weight: 10 },
      { type: "rewardId", rewardId: "multiplier_5x",      weight: 8  },
      { type: "rewardId", rewardId: "trophy_diamond",     weight: 8  },
      { type: "rewardId", rewardId: "skin_plasma",        weight: 7  },
      { type: "rewardId", rewardId: "skin_shadow",        weight: 7  },
      { type: "rewardId", rewardId: "skin_galaxy",        weight: 6  },
      { type: "rewardId", rewardId: "trail_rainbow",      weight: 6  },
      { type: "rewardId", rewardId: "world_glacier",      weight: 5  },
      { type: "rewardId", rewardId: "difficulty_extreme", weight: 5  },
      { type: "rewardId", rewardId: "powerup_shield",     weight: 4  },
      { type: "rewardId", rewardId: "powerup_frenzy",     weight: 4  },
      { type: "rewardId", rewardId: "heart_refill_full",  weight: 3  },
      { type: "rewardId", rewardId: "title_legendary",    weight: 3  },
      { type: "rewardId", rewardId: "title_speedster",    weight: 2  },
      { type: "rewardId", rewardId: "emote_crown",        weight: 2  },
      { type: "rewardId", rewardId: "chest_legendary",    weight: 1  }  // jackpot: another legendary!
    ]
  }
};

window.CHEST_ORDER = ["wooden", "silver", "gold", "crystal", "legendary"];
