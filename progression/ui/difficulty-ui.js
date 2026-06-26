// ui/difficulty-ui.js
(function () {
  let panel;

  function build() {
    panel = document.createElement("div");
    panel.id = "prog-difficulty-panel";
    panel.className = "prog-panel";
    document.body.appendChild(panel);
    render();
  }

  function render() {
    const state = window.ProgressionManager.getState();
    panel.innerHTML = `<div class="prog-panel-title">Difficulty</div>` +
      (window.DIFFICULTIES || []).map(d => {
        const unlocked = window.DifficultySystem.isUnlocked(d.id);
        const active = state.currentDifficulty === d.id;
        return `<button class="prog-difficulty-btn ${unlocked ? "" : "prog-locked"} ${active ? "prog-active" : ""}"
                  data-difficulty="${d.id}" ${unlocked ? "" : "disabled"}>
                  ${unlocked ? d.name : "🔒 " + d.name}
                </button>`;
      }).join("");

    panel.querySelectorAll(".prog-difficulty-btn").forEach(btn => {
      btn.addEventListener("click", () => window.DifficultySystem.select(btn.dataset.difficulty));
    });
  }

  window.DifficultyUI = { build, render };

  window.ProgressionEvents.on("progression:ready", build);
  window.ProgressionEvents.on("difficulty:unlocked", render);
  window.ProgressionEvents.on("difficulty:selected", render);
})();
