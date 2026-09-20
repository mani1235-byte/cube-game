// secrets.js — CUBE GAME hidden in-game secrets
// ============================================================================
// No text box, no code to type. Each secret below is a real trigger hidden
// somewhere in the game. When one fires, it calls window.cgSecrets.unlockSecret
// (defined in shop.js), which asks the server to verify and grant the reward —
// this file never knows what the reward actually is, only that the secret
// happened.
//
// Triggers only arm while the main menu is showing (isMenuVisible() from
// script.js), so they never fire by accident during normal gameplay input.

(function () {
  function fireSecret(id) {
    if (window.cgSecrets && typeof window.cgSecrets.unlockSecret === "function") {
      window.cgSecrets.unlockSecret(id);
    }
  }

  function onMainMenu() {
    return typeof isMenuVisible === "function" && typeof MENU_MAIN !== "undefined"
      && state && state.menus && state.menus.active === MENU_MAIN;
  }

  // ── Secret 1: Konami Code ──────────────────────────────────────────────
  // ↑ ↑ ↓ ↓ ← → ← → B A, entered anywhere while the main menu is open.
  const KONAMI_SEQUENCE = [
    "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
    "b", "a",
  ];
  let konamiProgress = 0;

  document.addEventListener("keydown", (e) => {
    if (!onMainMenu()) { konamiProgress = 0; return; }

    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const expected = KONAMI_SEQUENCE[konamiProgress];

    if (key === expected) {
      konamiProgress++;
      if (konamiProgress === KONAMI_SEQUENCE.length) {
        konamiProgress = 0;
        fireSecret("konami");
      }
    } else {
      // Allow the sequence to restart cleanly if the first key of a new
      // attempt matches, instead of just resetting to 0 and losing it.
      konamiProgress = (key === KONAMI_SEQUENCE[0]) ? 1 : 0;
    }
  });

  // ── Secret 2: Logo click easter egg ────────────────────────────────────
  // Click/tap the "CUBE GAME" title 10 times within 3 seconds on the main menu.
  const LOGO_CLICKS_NEEDED = 10;
  const LOGO_CLICK_WINDOW_MS = 3000;
  let logoClickTimes = [];

  const logo = document.getElementById("mainMenuLogo");
  if (logo) {
    logo.addEventListener("click", () => {
      if (!onMainMenu()) return;
      const now = Date.now();
      logoClickTimes.push(now);
      logoClickTimes = logoClickTimes.filter(t => now - t <= LOGO_CLICK_WINDOW_MS);
      if (logoClickTimes.length >= LOGO_CLICKS_NEEDED) {
        logoClickTimes = [];
        fireSecret("logoClicks");
      }
    });
  }
})();
