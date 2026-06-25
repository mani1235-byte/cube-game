// progression/ui/trophy-badge-sync.js
//
// Wires up the pre-existing HUD markup that had zero JS behind it:
//
// 1. The main-menu trophy badge (.trophy-badge[data-open-pass], the one
//    NOT inside #passOverlay) now opens the 3D Trophy Hall — it shows
//    trophies/league, so it should connect to the trophy room, not the
//    pass.
// 2. Both "🎫 BRAWL PASS" buttons (#openPassMenu, #openPassPause) now open
//    the 3D Brawl Pass Room (progression/three/scene-brawl-pass.js)
//    instead of the old flat #passOverlay modal.
// 3. Every trophy-count readout (#trophyHud .th-count, both
//    .tb-trophy-count) and now every league readout (.tb-league-name,
//    .tb-progress-fill, .tb-to-next, .tb-rank-icon / .th-icon) stay live,
//    driven by league-system.js. They were all hardcoded placeholders.
(function () {
  function shieldIconSvg(color) {
    return `<svg viewBox="0 0 24 24" fill="${color}"><path d="M12 2 L21 6 V12 C21 17 17 21 12 22 C7 21 3 17 3 12 V6 Z"/></svg>`;
  }

  function wireOpenButtons() {
    document.querySelectorAll("[data-open-pass]").forEach((el) => {
      if (el.closest("#passOverlay")) return; // static readout inside the (now-unused) flat modal
      el.addEventListener("click", () => { if (window.TrophyHall3D) window.TrophyHall3D.open(); });
    });
    ["openPassMenu", "openPassPause"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => { if (window.BrawlPassRoom3D) window.BrawlPassRoom3D.open(); });
    });
  }

  function refreshTrophyDisplays() {
    const state = window.ProgressionManager.getState();
    const trophies = state.trophies || 0;
    const info = window.LeagueSystem.getProgress(trophies);

    const hudCount = document.querySelector("#trophyHud .th-count");
    if (hudCount) hudCount.textContent = trophies;

    document.querySelectorAll(".tb-trophy-count").forEach((el) => { el.textContent = "🏆 " + trophies; });
    document.querySelectorAll(".tb-league-name").forEach((el) => { el.textContent = info.league.name; });
    document.querySelectorAll(".tb-progress-fill").forEach((el) => { el.style.width = Math.round(info.progress * 100) + "%"; });
    document.querySelectorAll(".tb-to-next").forEach((el) => {
      el.textContent = info.isMaxed ? "Top league reached!" : `${info.toNext} 🏆 to ${info.next.name}`;
    });
    document.querySelectorAll(".tb-rank-icon").forEach((el) => { el.innerHTML = shieldIconSvg(info.league.color); });
    const hudIcon = document.querySelector("#trophyHud .th-icon");
    if (hudIcon) hudIcon.innerHTML = shieldIconSvg(info.league.color);

    [".trophy-badge", "#trophyHud"].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty("--lc", info.league.color);
        el.style.setProperty("--lbg", info.league.bg);
        el.style.setProperty("--lglow", info.league.color + "55");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireOpenButtons);
  } else {
    wireOpenButtons();
  }

  window.ProgressionEvents.on("progression:ready", refreshTrophyDisplays);
  window.ProgressionEvents.on("trophies:gained", refreshTrophyDisplays);
})();
