// reward-system.js
// Single chokepoint for handing out rewards from REWARD_TABLE, regardless
// of source (xp milestone, trophy milestone, chest loot, achievement).
window.RewardSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.rewardsClaimed = state.rewardsClaimed || [];
  }

  function grant(rewardId, context) {
    const def = (window.REWARD_TABLE || {})[rewardId];
    if (!def) { console.warn("[RewardSystem] unknown rewardId:", rewardId); return; }

    state.rewardsClaimed.push({ rewardId, at: Date.now(), context: context || null });

    switch (def.type) {
      case "coins":
        window.CoinSystem && window.CoinSystem.earn(def.amount, "reward:" + rewardId);
        break;
      case "chest":
        window.ChestSystem && window.ChestSystem.addToInventory(def.chestId);
        break;
      case "trophyCase":
        window.TrophySystem && window.TrophySystem.addToCase(def.trophyId);
        break;
      case "world":
        window.WorldSystem && window.WorldSystem.unlock(def.worldId);
        break;
      case "difficulty":
        window.DifficultySystem && window.DifficultySystem.unlock(def.difficultyId);
        break;
      case "buff":
        applyBuff(def);
        break;
    }

    Events.emit("reward:granted", { rewardId, def, context });
    Events.emit("progression:dirty");
  }

  function applyBuff(def) {
    state.buffs = state.buffs || {};
    state.buffs[def.buff] = (state.buffs[def.buff] || 0) + def.amount;
    // best-effort hook into the live game object if it exists
    if (typeof window.player !== "undefined" && def.buff === "speed") {
      window.player.speed = (window.player.speed || 0) + def.amount;
    }
  }

  return { init, grant };
})();
