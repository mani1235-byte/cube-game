// reward-system.js
// Single chokepoint for handing out rewards from REWARD_TABLE, regardless
// of source (xp milestone, trophy milestone, chest loot, achievement).
window.RewardSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.rewardsClaimed  = state.rewardsClaimed  || [];
    state.unlockedSkins   = state.unlockedSkins   || [];
    state.unlockedTrails  = state.unlockedTrails  || [];
    state.unlockedTitles  = state.unlockedTitles  || [];
    state.unlockedEmotes  = state.unlockedEmotes  || [];
    state.powerupInventory= state.powerupInventory|| {};
    state.activeMultiplier= state.activeMultiplier|| null;
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

      case "xp":
        applyXP(def, rewardId);
        break;

      case "multiplier":
        applyMultiplier(def, rewardId);
        break;

      case "heartRefill":
        applyHeartRefill(def);
        break;

      case "skin":
        applySkin(def);
        break;

      case "trail":
        applyTrail(def);
        break;

      case "powerup":
        applyPowerup(def);
        break;

      case "title":
        applyTitle(def);
        break;

      case "emote":
        applyEmote(def);
        break;
    }

    Events.emit("reward:granted", { rewardId, def, context });
    Events.emit("progression:dirty");
  }

  function applyBuff(def) {
    state.buffs = state.buffs || {};
    state.buffs[def.buff] = (state.buffs[def.buff] || 0) + def.amount;
    if (typeof window.player !== "undefined" && def.buff === "speed") {
      window.player.speed = (window.player.speed || 0) + def.amount;
    }
  }

  function applyXP(def, rewardId) {
    // Directly add XP via XPSystem if available
    if (window.XPSystem && window.XPSystem.earn) {
      window.XPSystem.earn(def.amount, "reward:" + rewardId);
    } else {
      // Fallback: add to state directly
      state.xp = (state.xp || 0) + def.amount;
      Events.emit("xp:earned", { amount: def.amount, source: "reward:" + rewardId });
    }
    showRewardToast(def.icon + " " + def.label, "#ffe000");
  }

  function applyMultiplier(def, rewardId) {
    // Activate a score multiplier in the live game
    state.activeMultiplier = { amount: def.amount, expiresAt: Date.now() + def.durationMs };

    // Hook into live game engine if running
    if (typeof window.activateMultiplier === "function") {
      window.activateMultiplier(def.amount, def.durationMs);
    } else {
      // Store it to be picked up when game starts / next tick
      window._pendingMultiplier = { amount: def.amount, durationMs: def.durationMs };
    }
    showRewardToast(def.icon + " " + def.label, "#ff8800");
  }

  function applyHeartRefill(def) {
    if (typeof window.hearts !== "undefined" && typeof window.MAX_HEARTS !== "undefined") {
      window.hearts = Math.min(window.MAX_HEARTS, (window.hearts || 0) + def.amount);
      if (typeof window.renderHearts === "function") window.renderHearts();
    } else {
      // Queue it for next game session
      state.pendingHearts = (state.pendingHearts || 0) + def.amount;
    }
    showRewardToast(def.icon + " " + def.label, "#ff4466");
  }

  function applySkin(def) {
    if (!state.unlockedSkins.includes(def.skinId)) {
      state.unlockedSkins.push(def.skinId);
    }
    // Auto-equip if nothing is equipped yet
    if (!state.equippedSkin) {
      state.equippedSkin = def.skinId;
      applyEquippedSkin(def.skinId);
    }
    showRewardToast(def.icon + " " + def.label, "#cc44ff");
    Events.emit("skin:unlocked", { skinId: def.skinId });
  }

  function applyTrail(def) {
    if (!state.unlockedTrails.includes(def.trailId)) {
      state.unlockedTrails.push(def.trailId);
    }
    if (!state.equippedTrail) {
      state.equippedTrail = def.trailId;
    }
    showRewardToast(def.icon + " " + def.label, "#44ccff");
    Events.emit("trail:unlocked", { trailId: def.trailId });
  }

  function applyPowerup(def) {
    state.powerupInventory[def.powerupId] = (state.powerupInventory[def.powerupId] || 0) + 1;
    showRewardToast(def.icon + " " + def.label, "#ff6600");
    Events.emit("powerup:added", { powerupId: def.powerupId, count: state.powerupInventory[def.powerupId] });
  }

  function applyTitle(def) {
    if (!state.unlockedTitles.includes(def.titleId)) {
      state.unlockedTitles.push(def.titleId);
    }
    showRewardToast(def.icon + " " + def.label, "#ffd700");
    Events.emit("title:unlocked", { titleId: def.titleId });
  }

  function applyEmote(def) {
    if (!state.unlockedEmotes.includes(def.emoteId)) {
      state.unlockedEmotes.push(def.emoteId);
    }
    showRewardToast(def.icon + " " + def.label, "#00ffcc");
    Events.emit("emote:unlocked", { emoteId: def.emoteId });
  }

  // ── Skin colour tables applied to live game ────────────────────────────────
  const SKIN_COLORS = {
    fire:    { r: 0xff, g: 0x55, b: 0x00 },
    ice:     { r: 0x88, g: 0xdd, b: 0xff },
    rainbow: null, // animated — handled by cube renderer
    neon:    { r: 0xcc, g: 0x00, b: 0xff },
    galaxy:  { r: 0x22, g: 0x00, b: 0x88 },
    golden:  { r: 0xff, g: 0xd7, b: 0x00 },
    shadow:  { r: 0x22, g: 0x22, b: 0x33 },
    plasma:  { r: 0x00, g: 0xff, b: 0xcc },
  };

  function applyEquippedSkin(skinId) {
    const color = SKIN_COLORS[skinId];
    if (color && typeof window.BLUE !== "undefined") {
      // Override the global cube colour for this session
      window._skinColor = color;
    }
  }

  // ── Utility: brief toast notification ─────────────────────────────────────
  function showRewardToast(message, color) {
    let el = document.createElement("div");
    el.style.cssText = [
      "position:fixed", "top:18%", "left:50%", "transform:translateX(-50%) scale(0.85)",
      "font-family:'Orbitron',monospace", "font-size:clamp(14px,3.5vw,22px)",
      "font-weight:900", "letter-spacing:0.08em",
      "padding:10px 22px", "border-radius:12px",
      "background:rgba(0,0,0,0.82)", `border:2px solid ${color}`,
      `color:${color}`, `text-shadow:0 0 12px ${color}`,
      "pointer-events:none", "z-index:99999",
      "opacity:0", "transition:opacity 0.25s, transform 0.25s",
      "white-space:nowrap"
    ].join(";");
    el.textContent = "✦ " + message + " ✦";
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) scale(1)";
    });
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) scale(0.8)";
      setTimeout(() => el.remove(), 350);
    }, 2400);
  }

  return { init, grant, showRewardToast, SKIN_COLORS };
})();
