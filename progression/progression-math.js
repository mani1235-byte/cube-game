// progression-math.js
// Pure, stateless math helpers used across the progression system.
window.ProgressionMath = (function () {
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function randRange(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }

  // Pick one entry from a weighted-pool array of { weight, ... } objects.
  function weightedPick(pool) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
  }

  // Resolve the level + progress-to-next-level for a given XP total,
  // using XP_LEVELS for known levels and XP_CURVE_TAIL beyond that.
  function levelForXP(xp) {
    const levels = window.XP_LEVELS || [{ level: 1, xpRequired: 0 }];
    let current = levels[0];
    for (const entry of levels) {
      if (xp >= entry.xpRequired) current = entry;
      else break;
    }
    // find next threshold (explicit or procedurally generated)
    const idx = levels.indexOf(current);
    let next = levels[idx + 1];
    if (!next) {
      const tail = window.XP_CURVE_TAIL;
      if (tail && current.level >= tail.baseLevel) {
        const levelsPast = current.level - tail.baseLevel;
        const cost = Math.round(tail.perLevel * Math.pow(tail.growth, levelsPast));
        next = { level: current.level + 1, xpRequired: current.xpRequired + cost };
      }
    }
    const span = next ? next.xpRequired - current.xpRequired : 1;
    const into = next ? clamp(xp - current.xpRequired, 0, span) : 0;
    return {
      level: current.level,
      xpIntoLevel: into,
      xpForNextLevel: span,
      progress: next ? into / span : 1,
      nextLevel: next ? next.level : current.level
    };
  }

  return { clamp, lerp, easeOutCubic, randRange, weightedPick, levelForXP };
})();
