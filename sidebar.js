// ===== Cube Game Sidebar =====
(function () {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    const toggleBtn = document.querySelector(".cg-sidebar-toggle");
    const sidebar = document.querySelector(".cg-sidebar");
    const backdrop = document.querySelector(".cg-sidebar-backdrop");
    const homeBtn = document.querySelector("[data-cg-home]");

    function openSidebar() {
      sidebar.classList.add("cg-open");
      backdrop.classList.add("cg-open");
    }

    function closeSidebar() {
      sidebar.classList.remove("cg-open");
      backdrop.classList.remove("cg-open");
    }

    toggleBtn.addEventListener("click", () => {
      sidebar.classList.contains("cg-open") ? closeSidebar() : openSidebar();
    });

    backdrop.addEventListener("click", closeSidebar);

    // Home -> jump back to the main menu using the game's own "MAIN MENU" buttons
    if (homeBtn) {
      homeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const mainMenuBtn = document.querySelector(
          ".menu-btn--pause, .menu-btn--score"
        );
        if (mainMenuBtn) mainMenuBtn.click();
        closeSidebar();
      });
    }

    // Leaderboard uses [data-open-leaderboard], already handled by leaderboard.js.
    // Close the sidebar once any nav link/button inside it is used.
    sidebar.querySelectorAll("a, button").forEach((el) => {
      el.addEventListener("click", () => {
        if (el !== homeBtn) closeSidebar();
      });
    });
  });
})();
