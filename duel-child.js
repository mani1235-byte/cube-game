// duel-child.js
// Runs inside the REAL normal-mode 3D game (index.html) when it's loaded as
// a player's own panel in a networked Duel match (lobby.html). This is the
// same "instant loss" ruleset as the local split-screen Competition mode —
// missing a good cube OR destroying a bomb ends the game immediately — but
// reported to lobby.html (the parent page) instead of a sibling iframe, so
// it can be relayed to a remote opponent over the network.
(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  if (!params.has("duelChild")) return;

  // Reuses mechanics.js's existing "bomb destroyed → instant endGame()"
  // patch, which is already gated on this flag (see mechanics.js tick()).
  // Falling cubes are already an instant loss in every mode (script.js).
  window.CGCompetitionChild = true;
  window._cgCompetitionLossReason = null;

  let reported = false;
  let lastProgressAt = 0;

  function post(type, extra) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(Object.assign({ source: "cube-game-duel", type }, extra || {}), location.origin);
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

  function currentScore() {
    return (window.state && window.state.game) ? (window.state.game.score || 0) : 0;
  }

  function reportEnd(reason) {
    if (reported) return;
    reported = true;
    post("end", { reason: reason || "missed", score: currentScore() });
  }

  function reportProgress(now) {
    if (reported) return;
    if (now - lastProgressAt < 400) return;
    lastProgressAt = now;
    post("progress", { score: currentScore() });
  }

  function boot() {
    hideExtraUI();

    if (typeof setGameMode === "function") setGameMode(GAME_MODE_RANKED);
    if (typeof resetGame === "function") resetGame();
    if (typeof setActiveMenu === "function") setActiveMenu(null);
    try { window._cgCompetitionNoSession = true; } catch (_) {}

    post("ready");

    if (typeof window.endGame === "function" && !window._cgDuelEndWrapped) {
      window._cgDuelEndWrapped = true;
      const originalEndGame = window.endGame;
      window.endGame = function () {
        const reason = window._cgCompetitionLossReason || "missed";
        reportEnd(reason);
        return originalEndGame.apply(this, arguments);
      };
    }

    // Keep the opponent's live-score panel updated.
    setInterval(() => reportProgress(performance.now()), 400);

    // Parent can tell us the match already ended (opponent lost/disconnected)
    // so we freeze/stop reporting instead of racing a stale local endGame.
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin) return;
      const d = event.data || {};
      if (d.source === "cube-game-duel-host" && d.type === "stop") {
        reported = true;
      }
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => setTimeout(boot, 250));
  } else {
    setTimeout(boot, 250);
  }
})();
