// chest-loot.js
// Pure loot-rolling logic, separate from spawning/animation so it's easy
// to unit-test or rebalance independently.
window.ChestLoot = (function () {
  function rollChest(chestId) {
    const def = (window.CHEST_TABLE || {})[chestId];
    if (!def) return null;
    const entry = window.ProgressionMath.weightedPick(def.loot);
    return resolveEntry(entry, chestId);
  }

  function resolveEntry(entry, chestId) {
    switch (entry.type) {
      case "coins": {
        const amount = window.ProgressionMath.randRange(entry.min, entry.max);
        return { type: "coins", amount, label: `${amount} Coins`, icon: "🪙" };
      }
      case "rewardId": {
        const def = (window.REWARD_TABLE || {})[entry.rewardId];
        return { type: "rewardId", rewardId: entry.rewardId, label: def ? def.label : entry.rewardId, icon: def ? def.icon : "🎁" };
      }
      case "chestUpgrade": {
        const upgraded = (window.CHEST_TABLE || {})[entry.to];
        return { type: "chestUpgrade", chestId: entry.to, label: `Upgraded to ${upgraded ? upgraded.name : entry.to}!`, icon: "✨" };
      }
      default:
        return { type: "unknown", label: "???", icon: "❓" };
    }
  }

  return { rollChest };
})();
