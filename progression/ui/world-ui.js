// ui/world-ui.js
(function () {
  let panel;

  function build() {
    panel = document.createElement("div");
    panel.id = "prog-world-panel";
    panel.className = "prog-panel";
    document.body.appendChild(panel);
    render();
  }

  function render() {
    const state = window.ProgressionManager.getState();
    panel.innerHTML = `<div class="prog-panel-title">Worlds</div>` +
      `<button class="prog-world-btn prog-portal-room-btn">🌍 Enter Portal Room</button>` +
      (window.WORLDS || []).map(w => {
        const unlocked = window.WorldSystem.isUnlocked(w.id);
        const active = state.currentWorld === w.id;
        return `<button class="prog-world-btn ${unlocked ? "" : "prog-locked"} ${active ? "prog-active" : ""}"
                  data-world="${w.id}" ${unlocked ? "" : "disabled"}
                  style="--portal-color:${w.portalColor}">
                  ${unlocked ? w.name : "🔒 " + w.name}
                </button>`;
      }).join("");

    panel.querySelector(".prog-portal-room-btn").addEventListener("click", () => { if (window.WorldPortals3D) window.WorldPortals3D.open(); });
    panel.querySelectorAll(".prog-world-btn[data-world]").forEach(btn => {
      btn.addEventListener("click", () => window.WorldSystem.travelTo(btn.dataset.world));
    });
  }

  window.WorldUI = { build, render };

  window.ProgressionEvents.on("progression:ready", build);
  window.ProgressionEvents.on("world:unlocked", render);
  window.ProgressionEvents.on("world:travel", render);
})();
