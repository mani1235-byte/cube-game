// ===== Cube Game Sidebar =====
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const toggleBtn = document.querySelector(".cg-sidebar-toggle");
    const navLinks = document.querySelector(".cg-nav-links");
    const homeBtn = document.querySelector("[data-cg-home]");

    toggleBtn.addEventListener("click", () => {
      navLinks.classList.toggle("cg-open");
    });

    // ── Progress / Missions sidebar buttons ───────────────────────────────
    // The actual panels are still built by progression-menu.js / mission-ui.js
    // (they append a "☰ Progress" / "🎯 Missions" toggle button to <body> once
    // progression data is ready). We simply forward clicks from the sidebar
    // buttons to those real toggle buttons, then hide the originals via CSS
    // (see sidebar.css) so they don't show up twice on screen.
    function wireProgressionButton(sidebarSelector, realBtnId) {
      const sidebarBtn = document.querySelector(sidebarSelector);
      if (!sidebarBtn) return;
      sidebarBtn.addEventListener("click", () => {
        const realBtn = document.getElementById(realBtnId);
        if (realBtn) {
          realBtn.click();
        } else {
          // Progression UI hasn't built its buttons yet — retry shortly.
          setTimeout(() => document.getElementById(realBtnId)?.click(), 300);
        }
      });
    }
    wireProgressionButton("[data-cg-progress]", "prog-menu-toggle");
    wireProgressionButton("[data-cg-missions]", "prog-mission-toggle");

    // Home -> jump back to the main menu using the game's own "MAIN MENU" buttons
    if (homeBtn) {
      homeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const mainMenuBtn = document.querySelector(
          ".menu-btn--pause, .menu-btn--score"
        );
        if (mainMenuBtn) mainMenuBtn.click();
        navLinks.classList.remove("cg-open");
      });
    }

    // Leaderboard uses [data-open-leaderboard], already handled by leaderboard.js.
    // Close the mobile menu once a nav link/button is used.
    navLinks.querySelectorAll("a, button").forEach((el) => {
      el.addEventListener("click", () => {
        if (el !== homeBtn) navLinks.classList.remove("cg-open");
      });
    });

    // ── Hide the whole sidebar during actual gameplay ─────────────────────
    // .menu elements never use display:none (they fade via opacity/visibility),
    // so we use the game's own isInGame() state instead of watching CSS.
    const sidebar = document.querySelector(".cg-sidebar");
    if (sidebar && typeof isInGame === "function") {
      function syncSidebarVisibility() {
        sidebar.style.display = isInGame() ? "none" : "";
      }
      setInterval(syncSidebarVisibility, 200);
      syncSidebarVisibility();
    }
  });
})();
