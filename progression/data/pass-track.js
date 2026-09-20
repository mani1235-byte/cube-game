// data/pass-track.js
// 70-tier Brawl Pass track. Every tier costs 200 XP.
// Reworked so Silver, Gold, Crystal and Legendary chests are all
// earnable naturally through normal play — not hidden behind huge walls.
window.PASS_TRACK = Array.from({ length: 70 }, (_, idx) => {
  const tier = idx + 1;
  let rewardId;

  if      (tier === 70) rewardId = "chest_legendary";   // Grand finale
  else if (tier === 60) rewardId = "chest_crystal";     // Late-game crystal
  else if (tier === 50) rewardId = "chest_legendary";   // Mid-late bonus
  else if (tier === 40) rewardId = "chest_crystal";     // Mid crystal
  else if (tier === 30) rewardId = "chest_gold";        // Solid gold milestone
  else if (tier === 20) rewardId = "chest_silver";      // Early silver
  else if (tier === 10) rewardId = "chest_wooden";      // First chest milestone
  else if (tier % 10 === 0) rewardId = "chest_gold";   // Every 10 tiers = gold
  else if (tier % 7 === 0) rewardId = "chest_crystal";  // Every 7 tiers = crystal!
  else if (tier % 5 === 0) rewardId = "chest_silver";   // Every 5 tiers = silver
  else if (tier % 3 === 0) rewardId = "coins_medium";
  else                    rewardId = "coins_small";

  return { tier, xpRequired: tier * 200, rewardId };
});
