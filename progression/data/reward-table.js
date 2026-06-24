// data/reward-table.js
// Central registry of every reward that can be granted by XP, trophies,
// chests, or achievements. reward-system.js looks ids up from here.
window.REWARD_TABLE = {
  coins_small:    { type: "coins", amount: 50,   label: "50 Coins",  icon: "🪙" },
  coins_medium:   { type: "coins", amount: 200,  label: "200 Coins", icon: "🪙" },
  coins_large:    { type: "coins", amount: 750,  label: "750 Coins", icon: "🪙" },

  chest_wooden:    { type: "chest", chestId: "wooden",    label: "Wooden Chest",    icon: "📦" },
  chest_silver:    { type: "chest", chestId: "silver",    label: "Silver Chest",    icon: "🎁" },
  chest_gold:      { type: "chest", chestId: "gold",      label: "Gold Chest",      icon: "🏆" },
  chest_crystal:   { type: "chest", chestId: "crystal",   label: "Crystal Chest",   icon: "💠" },
  chest_legendary: { type: "chest", chestId: "legendary", label: "Legendary Chest", icon: "👑" },

  trophy_silver:  { type: "trophyCase", trophyId: "silver",  label: "Silver Trophy",  icon: "🥈" },
  trophy_gold:    { type: "trophyCase", trophyId: "gold",    label: "Gold Trophy",    icon: "🥇" },
  trophy_diamond: { type: "trophyCase", trophyId: "diamond", label: "Diamond Trophy", icon: "💎" },

  world_desert:   { type: "world", worldId: "desert", label: "Desert World Unlocked", icon: "🏜️" },
  world_volcano:  { type: "world", worldId: "volcano", label: "Volcano World Unlocked", icon: "🌋" },
  world_glacier:  { type: "world", worldId: "glacier", label: "Glacier World Unlocked", icon: "🧊" },

  difficulty_hard:    { type: "difficulty", difficultyId: "hard",    label: "Hard Mode Unlocked",    icon: "🔥" },
  difficulty_extreme: { type: "difficulty", difficultyId: "extreme", label: "Extreme Mode Unlocked", icon: "☠️" },

  cosmetic_speed: { type: "buff", buff: "speed", amount: 2, label: "+2 Speed", icon: "⚡" }
};
