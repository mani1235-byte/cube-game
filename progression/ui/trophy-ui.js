// ui/trophy-ui.js
(function () {
  let countEl;

  function build() {
    const root = document.createElement("div");
    root.id = "prog-trophy-counter";
    root.className = "prog-widget prog-trophy-widget";
    root.innerHTML = `🏆 <span id="prog-trophy-count">0</span>`;
    root.style.cursor = "pointer";
    root.title = "Enter the Trophy Hall";
    root.addEventListener("click", () => { if (window.TrophyHall3D) window.TrophyHall3D.open(); });
    document.body.appendChild(root);
    countEl = root.querySelector("#prog-trophy-count");
  }

  function refresh() {
    const state = window.ProgressionManager.getState();
    countEl.textContent = state.trophies || 0;
  }

  function bump() {
    countEl.parentElement.classList.remove("prog-pulse");
    void countEl.parentElement.offsetWidth;
    countEl.parentElement.classList.add("prog-pulse");
  }

  window.TrophyUI = { build, refresh };

  window.ProgressionEvents.on("progression:ready", () => { build(); refresh(); });
  window.ProgressionEvents.on("trophies:gained", () => { refresh(); bump(); });
  window.ProgressionEvents.on("trophies:milestone", (m) => {
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🏆", label: `Milestone: ${m.trophies} trophies!` });
  });
})();
