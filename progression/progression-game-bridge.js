// progression-game-bridge.js
//
// script.js's endGame() already expects two globals that were never
// implemented anywhere in the project:
//
//   window.CGTrophies.applyMatchResult(score)   -> trophyInfo
//   window.CGTrophies.renderMatchResult(info)   -> fills #trophyResult
//
// Because that call is wrapped in try/catch, trophies silently never
// fired from real gameplay — this is the "trophies don't open" bug.
// This file implements that missing bridge.
//
// IMPORTANT: CGTrophies talks only to TrophySystem, and the (separate,
// optional) CGXP talks only to XPSystem. Neither bridge calls into the
// other system — XP and trophies are awarded independently from the same
// match-end event, but the two progression systems remain fully decoupled
// from each other internally (see trophy-system.js / xp-system.js).
(function () {
  const Events = window.ProgressionEvents;

  // ---- Trophies --------------------------------------------------------
  window.CGTrophies = {
    applyMatchResult(score) {
      const ratio = (window.ProgressionConfig.trophies || {}).scoreToTrophyRatio || 50;
      const gained = Math.max(0, Math.floor((score || 0) / ratio));
      const before = window.ProgressionManager.getState().trophies || 0;

      const milestonesHit = [];
      const unsub = Events.on("trophies:milestone", (m) => milestonesHit.push(m));
      if (gained > 0) window.TrophySystem.add(gained);
      unsub();

      const total = window.ProgressionManager.getState().trophies || 0;
      return { gained, before, total, milestones: milestonesHit };
    },

    renderMatchResult(info) {
      const el = document.getElementById("trophyResult");
      if (!el) return;
      if (!info || info.gained <= 0) { el.innerHTML = ""; return; }
      el.innerHTML =
        `<div class="prog-match-trophies">🏆 +${info.gained} Trophies <span class="prog-match-trophies-total">(${info.total} total)</span></div>` +
        info.milestones.map(m => `<div class="prog-match-milestone">🎉 Milestone: ${m.trophies} trophies!</div>`).join("");
    }
  };

  // ---- XP (independent of trophies, same match-end trigger) ------------
  window.CGXP = {
    applyMatchResult(score) {
      const perWin = window.ProgressionConfig.xp.perWin || 0;
      const before = window.ProgressionManager.getState().xp || 0;
      const beforeLevel = window.ProgressionManager.getState().level || 1;

      window.XPSystem.add(perWin, "match_end");

      const after = window.ProgressionManager.getState();
      return { gained: perWin, before, total: after.xp, leveledUp: after.level > beforeLevel, level: after.level };
    },

    renderMatchResult() {
      // No dedicated DOM target — the persistent XP bar (ui/xp-ui.js) and
      // the level-up toast (ui/reward-popup.js) already react live to the
      // xp:gained / xp:levelup events fired above, so there's nothing
      // extra to render here. Kept as a no-op for call-site symmetry with
      // CGTrophies.
    }
  };
})();
