// ui/xp-ui.js
(function () {
  let barFillEl, levelEl, xpTextEl;

  function build() {
    const root = document.createElement("div");
    root.id = "prog-xp-bar";
    root.className = "prog-widget prog-xp-widget";
    root.innerHTML = `
      <div class="prog-xp-level" id="prog-xp-level">Lv 1</div>
      <div class="prog-xp-track"><div class="prog-xp-fill" id="prog-xp-fill"></div></div>
      <div class="prog-xp-text" id="prog-xp-text">0 / 100 XP</div>
    `;
    root.style.cursor = "pointer";
    root.title = "Enter the XP Crystal Chamber";
    root.addEventListener("click", () => { if (window.XPChamber3D) window.XPChamber3D.open(); });
    document.body.appendChild(root);
    levelEl = root.querySelector("#prog-xp-level");
    barFillEl = root.querySelector("#prog-xp-fill");
    xpTextEl = root.querySelector("#prog-xp-text");
  }

  function refresh() {
    const p = window.XPSystem.getProgress();
    levelEl.textContent = "Lv " + p.level;
    const pct = Math.round(p.progress * 100);
    barFillEl.style.transition = `width ${window.ProgressionConfig.ui.xpBarAnimMs}ms ease-out`;
    barFillEl.style.width = pct + "%";
    xpTextEl.textContent = `${p.xpIntoLevel} / ${p.xpForNextLevel} XP`;
  }

  function pulseLevelUp(level) {
    levelEl.classList.remove("prog-pulse");
    void levelEl.offsetWidth; // restart animation
    levelEl.classList.add("prog-pulse");
    if (window.RewardPopup) window.RewardPopup.show({ icon: "⭐", label: `Level ${level}!` });
  }

  window.XPUI = { build, refresh, pulseLevelUp };

  window.ProgressionEvents.on("progression:ready", () => { build(); refresh(); });
  window.ProgressionEvents.on("xp:gained", refresh);
  window.ProgressionEvents.on("xp:levelup", ({ level }) => pulseLevelUp(level));
  window.ProgressionEvents.on("level:milestone", (m) => {
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🎚️", label: `Milestone: Level ${m.level}!` });
  });
})();
