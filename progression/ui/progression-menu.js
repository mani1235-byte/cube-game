// ui/progression-menu.js
// Collapsible side menu that hosts the world/difficulty/chest panels and a
// toggle button, so the HUD (xp/coin/trophy bars) stays minimal during
// gameplay and the deeper panels open on demand.
(function () {
  let menuEl, toggleBtn, open = false;

  function build() {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "prog-menu-toggle";
    toggleBtn.className = "prog-widget";
    toggleBtn.textContent = "☰ Progress";
    toggleBtn.addEventListener("click", toggle);
    document.body.appendChild(toggleBtn);

    menuEl = document.createElement("div");
    menuEl.id = "prog-menu";
    menuEl.className = "prog-menu prog-menu-closed";
    document.body.appendChild(menuEl);
  }

  function toggle() {
    open = !open;
    menuEl.classList.toggle("prog-menu-closed", !open);
    menuEl.classList.toggle("prog-menu-open", open);
  }

  function relocatePanels() {
    // Mission panel is intentionally excluded here — it now lives in its own
    // standalone toggle/menu built by mission-ui.js, to the right of this one.
    ["prog-world-panel", "prog-difficulty-panel", "prog-chest-panel"].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.parentElement !== menuEl) menuEl.appendChild(el);
    });
  }

  window.ProgressionEvents.on("progression:ready", () => {
    build();
    // wait a tick so world/difficulty/chest UI have built their panels
    setTimeout(relocatePanels, 0);
  });
})();
