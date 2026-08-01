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
    // Same approach as profile-avatar.js: watch .menu--main's visibility.
    const sidebar = document.querySelector(".cg-sidebar");
    const mainMenu = document.querySelector(".menu--main");
    if (sidebar && mainMenu) {
      function syncSidebarVisibility() {
        const d = getComputedStyle(mainMenu).display;
        sidebar.style.display = d === "none" ? "none" : "";
      }
      const observer = new MutationObserver(syncSidebarVisibility);
      observer.observe(mainMenu, { attributes: true, attributeFilter: ["style", "class"] });
      setInterval(syncSidebarVisibility, 500);
      syncSidebarVisibility();
    }
  });
})();
