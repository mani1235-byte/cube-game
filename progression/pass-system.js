// progression/pass-system.js
window.PassSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.passTiersClaimed = state.passTiersClaimed || {};
    Events.on("xp:gained", checkTiers);
    checkTiers(); // catch up immediately in case XP was already earned before this loaded
  }

  function checkTiers() {
    (window.PASS_TRACK || []).forEach(t => {
      if (state.xp >= t.xpRequired && !state.passTiersClaimed[t.tier]) {
        state.passTiersClaimed[t.tier] = { at: Date.now() };
        Events.emit("pass:tier", t);
        if (window.RewardSystem) window.RewardSystem.grant(t.rewardId, { source: "pass_tier", tier: t.tier });
      }
    });
  }

  // current tier + progress into the *next* tier, derived purely from xp
  function getProgress() {
    const track = window.PASS_TRACK || [];
    const xp = state ? state.xp : 0;
    let tier = 0;
    for (const t of track) { if (xp >= t.xpRequired) tier = t.tier; else break; }

    const cur = track[tier - 1] || null;
    const next = track[tier] || null; // array index `tier` is the (tier+1)'th entry
    const base = cur ? cur.xpRequired : 0;
    const span = next ? (next.xpRequired - base) : 200;
    const into = Math.max(0, xp - base);

    return {
      tier,
      maxTier: track.length,
      isMaxed: !next,
      xpIntoTier: next ? into : 0,
      xpForTier: span,
      progress: next ? Math.min(1, into / span) : 1,
      next
    };
  }

  return { init, checkTiers, getProgress };
})();
