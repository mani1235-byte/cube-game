// ui/chest-ui.js
(function () {
  let panel;

  function build() {
    panel = document.createElement("div");
    panel.id = "prog-chest-panel";
    panel.className = "prog-panel prog-chest-panel";
    document.body.appendChild(panel);
    render();
  }

  function render() {
    const state = window.ProgressionManager.getState();
    const inv = state.chestInventory || [];
    panel.innerHTML = `<div class="prog-panel-title">Chests</div><div class="prog-chest-row">` +
      (inv.length
        ? inv.map((id, i) => {
            const def = window.CHEST_TABLE[id];
            return `<button class="prog-chest-icon" data-idx="${i}" data-chest="${id}"
                      style="--chest-color:${def.color};--chest-glow:${def.glow}" title="${def.name}">
                      <img src="${def.image}" alt="${def.name}" class="prog-chest-img" />
                    </button>`;
          }).join("")
        : `<span class="prog-empty">No chests yet — keep playing!</span>`) +
      `</div>`;

    panel.querySelectorAll(".prog-chest-icon").forEach(btn => {
      btn.addEventListener("click", () => {
        if (window.RewardRoom3D) window.RewardRoom3D.open(btn.dataset.chest);
        else window.ChestSystem.open(btn.dataset.chest);
      });
    });
  }

  window.ChestUI = { build, render };

  window.ProgressionEvents.on("progression:ready", build);
  window.ProgressionEvents.on("chest:added", render);
  window.ProgressionEvents.on("chest:opened", ({ loot }) => {
    render();
    if (loot) window.RewardPopup.show({ icon: loot.icon, label: loot.label });
  });
})();
