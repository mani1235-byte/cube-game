// data/reward-table.js
// Central registry of every reward that can be granted by XP, trophies,
// chests, or achievements. reward-system.js looks ids up from here.
window.REWARD_TABLE = {

  // ── Coins ──────────────────────────────────────────────────────────────────
  coins_small:    { type: "coins", amount: 50,   label: "50 Coins",   icon: "🪙" },
  coins_medium:   { type: "coins", amount: 200,  label: "200 Coins",  icon: "🪙" },
  coins_large:    { type: "coins", amount: 750,  label: "750 Coins",  icon: "🪙" },
  coins_mega:     { type: "coins", amount: 2000, label: "2,000 Coins",icon: "🪙" },

  // ── Chests ─────────────────────────────────────────────────────────────────
  chest_wooden:    { type: "chest", chestId: "wooden",    label: "Wooden Chest",    icon: "📦" },
  chest_silver:    { type: "chest", chestId: "silver",    label: "Silver Chest",    icon: "🎁" },
  chest_gold:      { type: "chest", chestId: "gold",      label: "Gold Chest",      icon: "🏆" },
  chest_crystal:   { type: "chest", chestId: "crystal",   label: "Crystal Chest",   icon: "💠" },
  chest_legendary: { type: "chest", chestId: "legendary", label: "Legendary Chest", icon: "👑" },

  // ── Trophies ───────────────────────────────────────────────────────────────
  trophy_silver:  { type: "trophyCase", trophyId: "silver",  label: "Silver Trophy",  icon: "🥈" },
  trophy_gold:    { type: "trophyCase", trophyId: "gold",    label: "Gold Trophy",    icon: "🥇" },
  trophy_diamond: { type: "trophyCase", trophyId: "diamond", label: "Diamond Trophy", icon: "💎" },

  // ── Worlds ─────────────────────────────────────────────────────────────────
  world_desert:   { type: "world", worldId: "desert",  label: "Desert World Unlocked",  icon: "🏜️" },
  world_volcano:  { type: "world", worldId: "volcano", label: "Volcano World Unlocked", icon: "🌋" },
  world_glacier:  { type: "world", worldId: "glacier", label: "Glacier World Unlocked", icon: "🧊" },

  // ── Difficulty unlocks ─────────────────────────────────────────────────────
  difficulty_hard:    { type: "difficulty", difficultyId: "hard",    label: "Hard Mode Unlocked",    icon: "🔥" },
  difficulty_extreme: { type: "difficulty", difficultyId: "extreme", label: "Extreme Mode Unlocked", icon: "☠️" },

  // ── XP Boosts ──────────────────────────────────────────────────────────────
  xp_boost_small:  { type: "xp", amount: 100,  label: "+100 XP Bonus",  icon: "✨" },
  xp_boost_medium: { type: "xp", amount: 300,  label: "+300 XP Bonus",  icon: "⭐" },
  xp_boost_large:  { type: "xp", amount: 750,  label: "+750 XP Bonus",  icon: "🌟" },
  xp_boost_mega:   { type: "xp", amount: 2000, label: "+2,000 XP Mega Boost", icon: "💫" },

  // ── Score Multipliers (temporary in-game buff) ────────────────────────────
  multiplier_2x:   { type: "multiplier", amount: 2, durationMs: 120000, label: "2× Score for 2 min",  icon: "⚡" },
  multiplier_3x:   { type: "multiplier", amount: 3, durationMs: 90000,  label: "3× Score for 90 sec", icon: "🔥" },
  multiplier_5x:   { type: "multiplier", amount: 5, durationMs: 60000,  label: "5× Score for 60 sec", icon: "💥" },

  // ── Heart Refills ─────────────────────────────────────────────────────────
  heart_refill:    { type: "heartRefill", amount: 1, label: "+1 Heart Refill",     icon: "❤️" },
  heart_refill_full:{ type: "heartRefill", amount: 3, label: "Full Heart Restore", icon: "💖" },

  // ── Cosmetic Skins (cube trail/colour palettes) ───────────────────────────
  skin_fire:     { type: "skin", skinId: "fire",     label: "🔥 Fire Cube Skin",     icon: "🔥" },
  skin_ice:      { type: "skin", skinId: "ice",      label: "🧊 Ice Cube Skin",      icon: "🧊" },
  skin_rainbow:  { type: "skin", skinId: "rainbow",  label: "🌈 Rainbow Cube Skin",  icon: "🌈" },
  skin_neon:     { type: "skin", skinId: "neon",     label: "💜 Neon Cube Skin",     icon: "💜" },
  skin_galaxy:   { type: "skin", skinId: "galaxy",   label: "🌌 Galaxy Cube Skin",   icon: "🌌" },
  skin_golden:   { type: "skin", skinId: "golden",   label: "✨ Golden Cube Skin",   icon: "✨" },
  skin_shadow:   { type: "skin", skinId: "shadow",   label: "🖤 Shadow Cube Skin",   icon: "🖤" },
  skin_plasma:   { type: "skin", skinId: "plasma",   label: "⚡ Plasma Cube Skin",   icon: "⚡" },

  // ── Trail Effects ─────────────────────────────────────────────────────────
  trail_fire:    { type: "trail", trailId: "fire",   label: "🔥 Fire Slash Trail",   icon: "🔥" },
  trail_ice:     { type: "trail", trailId: "ice",    label: "❄️ Ice Slash Trail",    icon: "❄️" },
  trail_stars:   { type: "trail", trailId: "stars",  label: "⭐ Star Slash Trail",   icon: "⭐" },
  trail_plasma:  { type: "trail", trailId: "plasma", label: "⚡ Plasma Slash Trail", icon: "⚡" },
  trail_rainbow: { type: "trail", trailId: "rainbow",label: "🌈 Rainbow Trail",      icon: "🌈" },

  // ── Power-Ups (one-time in-game activations) ──────────────────────────────
  powerup_shield:  { type: "powerup", powerupId: "shield",  label: "🛡️ Heart Shield (1 game)", icon: "🛡️" },
  powerup_magnet:  { type: "powerup", powerupId: "magnet",  label: "🧲 Score Magnet",           icon: "🧲" },
  powerup_slowmo:  { type: "powerup", powerupId: "slowmo",  label: "⏱️ Slow-Mo Activator",      icon: "⏱️" },
  powerup_frenzy:  { type: "powerup", powerupId: "frenzy",  label: "🌀 Cube Frenzy (bonus wave)",icon: "🌀" },

  // ── Speed buff (original) ─────────────────────────────────────────────────
  cosmetic_speed: { type: "buff", buff: "speed", amount: 2, label: "+2 Speed", icon: "⚡" },

  // ── Title / Badge unlocks ─────────────────────────────────────────────────
  title_destroyer:  { type: "title", titleId: "destroyer",  label: "🗡️ Title: Cube Destroyer",    icon: "🗡️" },
  title_collector:  { type: "title", titleId: "collector",  label: "💼 Title: Treasure Collector", icon: "💼" },
  title_legendary:  { type: "title", titleId: "legendary",  label: "👑 Title: The Legendary",      icon: "👑" },
  title_speedster:  { type: "title", titleId: "speedster",  label: "⚡ Title: Speedster",          icon: "⚡" },

  // ── Emotes ────────────────────────────────────────────────────────────────
  emote_fire:   { type: "emote", emoteId: "fire",   label: "🔥 Fire Emote",   icon: "🔥" },
  emote_cool:   { type: "emote", emoteId: "cool",   label: "😎 Cool Emote",   icon: "😎" },
  emote_gg:     { type: "emote", emoteId: "gg",     label: "🎉 GG Emote",     icon: "🎉" },
  emote_crown:  { type: "emote", emoteId: "crown",  label: "👑 Crown Emote",  icon: "👑" },
};
