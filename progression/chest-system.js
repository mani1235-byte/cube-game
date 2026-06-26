// chest-system.js
// Owns chest inventory (chests the player has earned but not opened yet).
// Chests are earned by completing missions (see mission-system.js), not by
// a passive world-spawn timer — that auto-grant system has been removed.
// Opening visuals live entirely in three/scene-reward-room.js; opening
// timing lives in chest-animation.js.
window.ChestSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.chestInventory = state.chestInventory || []; // array of chestId strings, unopened
    state.chestsOpened = state.chestsOpened || 0;
  }

  function addToInventory(chestId) {
    if (!(window.CHEST_TABLE || {})[chestId]) { console.warn("[ChestSystem] unknown chest:", chestId); return; }
    if (state.chestInventory.length >= window.ProgressionConfig.chests.maxQueued) {
      // drop the lowest-rarity chest to make room rather than losing the new one
      state.chestInventory.sort((a, b) => window.CHEST_TABLE[a].rarity - window.CHEST_TABLE[b].rarity);
      state.chestInventory.shift();
    }
    state.chestInventory.push(chestId);
    Events.emit("chest:added", { chestId, inventory: state.chestInventory.slice() });
    Events.emit("progression:dirty");
  }

  function open(chestId) {
    const idx = state.chestInventory.indexOf(chestId);
    if (idx === -1) return null;
    state.chestInventory.splice(idx, 1);
    const loot = window.ChestLoot.rollChest(chestId);
    state.chestsOpened++;

    Events.emit("chest:opening", { chestId });
    // ChestAnimation drives the visual timing, then we apply the actual loot
    window.ChestAnimation.play(chestId, () => applyLoot(chestId, loot));

    if (state.chestsOpened === 1 && window.RewardSystem) {
      // first-chest achievement, fire once
      Events.emit("achievement:check", "first_chest");
    }
    if (state.chestsOpened === 5) Events.emit("achievement:check", "five_chests");

    Events.emit("progression:dirty");
    return loot;
  }

  function applyLoot(chestId, loot) {
    if (!loot) return;
    if (loot.type === "coins") window.CoinSystem.earn(loot.amount, "chest:" + chestId);
    if (loot.type === "rewardId") window.RewardSystem.grant(loot.rewardId, { source: "chest", chestId });
    if (loot.type === "chestUpgrade") addToInventory(loot.chestId);
    Events.emit("chest:opened", { chestId, loot });
  }

  return { init, addToInventory, open };
})();
