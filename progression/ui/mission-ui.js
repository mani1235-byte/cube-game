// ui/mission-ui.js
// Lists every mission with a live progress bar (claimed ones shown done,
// greyed/locked ones still in progress). Unlike world/difficulty/chest this
// panel is NOT folded into the shared "☰ Progress" menu — it gets its own
// toggle button and its own slide-out menu (own open/closed state, own DOM),
// positioned just to the right of the Progress toggle.
(function () {
  let toggleBtn, menuEl, panel, open = false;

  function build() {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "prog-mission-toggle";
    toggleBtn.className = "prog-widget";
    toggleBtn.textContent = "🎯 Missions";
    toggleBtn.addEventListener("click", toggle);
    document.body.appendChild(toggleBtn);

    menuEl = document.createElement("div");
    menuEl.id = "prog-mission-menu";
    menuEl.className = "prog-menu prog-mission-menu prog-menu-closed";
    document.body.appendChild(menuEl);

    panel = document.createElement("div");
    panel.id = "prog-mission-panel";
    panel.className = "prog-panel prog-mission-panel";
    menuEl.appendChild(panel);

    positionToRight();
    window.addEventListener("resize", positionToRight);

    render();
  }

  // Sits immediately to the right of the main Progress toggle, whatever
  // width that button ends up being (text length varies with locale).
  function positionToRight() {
    const mainToggle = document.getElementById("prog-menu-toggle");
    if (!mainToggle || !toggleBtn) return;
    const left = mainToggle.getBoundingClientRect().right + 10;
    toggleBtn.style.left = `${left}px`;
    if (menuEl) menuEl.style.left = `${left}px`;
  }

  function toggle() {
    open = !open;
    menuEl.classList.toggle("prog-menu-closed", !open);
    menuEl.classList.toggle("prog-menu-open", open);
  }

  function render() {
    if (!panel) return;
    const state = window.ProgressionManager.getState();
    const claimed = state.missionsClaimed || {};
    const missions = window.MISSIONS || [];

    panel.innerHTML = `<div class="prog-panel-title">Missions</div>` +
      (missions.length
        ? missions.map(m => {
            const done = !!claimed[m.id];
            const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🎁", label: m.rewardId };
            const current = Math.min(m.target, window.MissionSystem.getStat(m.type));
            const pct = Math.round((current / m.target) * 100);
            return `
              <div class="prog-mission-row ${done ? "prog-mission-done" : ""}">
                <div class="prog-mission-top">
                  <span class="prog-mission-label">${done ? "✅" : reward.icon} ${m.label}</span>
                  <span class="prog-mission-reward">${reward.label}</span>
                </div>
                <div class="prog-mission-track"><div class="prog-mission-fill" style="width:${pct}%"></div></div>
                <div class="prog-mission-progress">${current} / ${m.target}</div>
              </div>`;
          }).join("")
        : `<span class="prog-empty">No missions yet.</span>`);
  }

  window.MissionUI = { build, render };

  // Deferred one tick so progression-menu.js's "progression:ready" handler
  // (registered after this one, runs synchronously in the same emit pass)
  // has already created #prog-menu-toggle for positionToRight() to measure.
  window.ProgressionEvents.on("progression:ready", () => setTimeout(build, 0));
  window.ProgressionEvents.on("progression:dirty", render);
  window.ProgressionEvents.on("mission:completed", (m) => {
    render();
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🎯", label: `Mission complete: ${m.label}!` });
  });
})();
