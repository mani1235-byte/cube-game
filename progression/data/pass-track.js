// data/pass-track.js
// 70-tier Brawl Pass track (matches the "Tier 0 / 70" / "0 / 200 XP"
// scaffolding already in the pass UI markup) — each tier costs a flat
// 200 XP, reusing your existing lifetime XP total as the pass currency
// (no separate pass-XP system needed). Rewards reference REWARD_TABLE,
// reusing existing reward ids — tier 70 is the big finale.
window.PASS_TRACK = Array.from({ length: 70 }, (_, idx) => {
  const tier = idx + 1;
  let rewardId;
  if (tier === 70) rewardId = "chest_legendary";
  else if (tier % 10 === 0) rewardId = "chest_gold";
  else if (tier % 5 === 0) rewardId = "chest_silver";
  else if (tier % 3 === 0) rewardId = "coins_medium";
  else rewardId = "coins_small";
  return { tier, xpRequired: tier * 200, rewardId };
});
