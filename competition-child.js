// competition-child.js
// Runs inside each half of competition.html.
// Each child is a normal independent game: destroy good cubes, avoid bombs.
// Missing a good cube OR destroying a bomb = immediate loss.
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  if (!params.has("competitionChild")) return;

  const player = Number(params.get("player")) === 2 ? 2 : 1;
  window.CGCompetitionChild = true;
  window._cgCompetitionLossReason = null;
  let reported = false;

  function post(type, extra) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(Object.assign({
          source: "cube-game-competition",
          type,
          player
        }, extra || {}), location.origin);
      }
    } catch (_) {}
  }

  function hideExtraUI() {
    const style = document.createElement("style");
    style.textContent = `
      html, body { overflow:hidden !important; }
      body { background:#05070d !important; }
      #compHud, #compResult, .play-comp-btn { display:none !important; }
      .menu--main, .menu--pause, .menu--score { z-index:-1 !important; opacity:0 !important; pointer-events:none !important; }
      #score, #score-hud, #progression-menu, .progression-menu { pointer-events:none !important; }
    `;
    document.head.appendChild(style);
  }

  function reportEnd(reason) {
    if (reported) return;
    reported = true;
    post("end", {
      reason: reason || "missed",
      score: (window.state && window.state.game) ? window.state.game.score : 0
    });
  }

  function boot() {
    hideExtraUI();

    // Start a fresh ranked match in this iframe.
    if (typeof setGameMode === "function") setGameMode(GAME_MODE_RANKED);
    if (typeof resetGame === "function") resetGame();
    if (typeof setActiveMenu === "function") setActiveMenu(null);
    if (typeof startSessionTimer === "function") {
      // Competition has no separate session countdown.
      try { window._cgCompetitionNoSession = true; } catch (_) {}
    }

    post("ready");

    // Wrap the normal endGame so a missed cube or bomb loss is reported.
    if (typeof window.endGame === "function" && !window._cgCompetitionEndWrapped) {
      window._cgCompetitionEndWrapped = true;
      const originalEndGame = window.endGame;
      window.endGame = function () {
        const reason = window._cgCompetitionLossReason || "missed";
        reportEnd(reason);
        return originalEndGame.apply(this, arguments);
      };
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => setTimeout(boot, 250));
  } else {
    setTimeout(boot, 250);
  }
})();
