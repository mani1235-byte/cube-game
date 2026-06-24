// progression/ui/trophy-badge-sync.js
//
// Two unrelated bugs in the pre-existing HUD markup, fixed here:
//
// 1. The "Brawl Pass" modal (#passOverlay) existed in index.html but had
//    zero JS wiring anywhere — clicking the trophy-badge (title="Open
//    Brawl Pass") or either "🎫 BRAWL PASS" button did nothing. This adds
//    open/close behavior, mirroring shop.js's openShop()/closeShop().
//
// 2. Every trophy-count readout outside the progression system's own
//    widget (#trophyHud .th-count in the gameplay HUD, and .tb-trophy-count
//    inside both .trophy-badge instances) was hardcoded to "0" in the HTML
//    and never updated. This keeps them all live.
//
// NOTE: the league name ("Bronze I"), progress bar, and "to next" text in
// .trophy-badge are still static placeholders — there's no league/ladder
// system in this codebase yet, just the raw trophy count. Say the word if
// you want an actual Bronze→Masters league ladder built out; this file
// only fixes the open/close + live-count wiring.
(function () {
  function openPass() {
    const overlay = document.getElementById("passOverlay");
    if (overlay) overlay.classList.add("open");
  }
  function closePass() {
    const overlay = document.getElementById("passOverlay");
    if (overlay) overlay.classList.remove("open");
  }

  function wireOpenClose() {
    ["openPassMenu", "openPassPause"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", openPass);
    });

    // [data-open-pass] appears twice: once as the clickable main-menu badge,
    // and once as a static (cursor:default) readout *inside* the pass modal
    // itself — only wire the one that isn't already inside the modal.
    document.querySelectorAll("[data-open-pass]").forEach((el) => {
      if (!el.closest("#passOverlay")) el.addEventListener("click", openPass);
    });

    const closeBtn = document.getElementById("closePass");
    if (closeBtn) closeBtn.addEventListener("click", closePass);

    const overlay = document.getElementById("passOverlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === e.currentTarget) closePass(); });

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePass(); });
  }

  function refreshTrophyDisplays() {
    const state = window.ProgressionManager.getState();
    const trophies = state.trophies || 0;

    const hudCount = document.querySelector("#trophyHud .th-count");
    if (hudCount) hudCount.textContent = trophies;

    document.querySelectorAll(".tb-trophy-count").forEach((el) => {
      el.textContent = "🏆 " + trophies;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireOpenClose);
  } else {
    wireOpenClose();
  }

  window.ProgressionEvents.on("progression:ready", refreshTrophyDisplays);
  window.ProgressionEvents.on("trophies:gained", refreshTrophyDisplays);
})();
