// ui/reward-popup.js
// Generic toast used by every system to announce a reward, level-up,
// milestone, or achievement. Queues so multiple rewards don't overlap.
window.RewardPopup = (function () {
  let container;
  let queue = [];
  let showing = false;

  function ensureContainer() {
    if (container) return;
    container = document.createElement("div");
    container.id = "prog-reward-popup-layer";
    document.body.appendChild(container);
  }

  function show({ icon = "🎉", label = "Reward!" }) {
    ensureContainer();
    queue.push({ icon, label });
    if (!showing) dequeue();
  }

  function dequeue() {
    if (queue.length === 0) { showing = false; return; }
    showing = true;
    const { icon, label } = queue.shift();
    const el = document.createElement("div");
    el.className = "prog-reward-toast";
    el.innerHTML = `<span class="prog-reward-icon">${icon}</span><span class="prog-reward-label">${label}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("prog-reward-toast-in"));

    const duration = window.ProgressionConfig.ui.toastDurationMs;
    setTimeout(() => {
      el.classList.remove("prog-reward-toast-in");
      el.classList.add("prog-reward-toast-out");
      setTimeout(() => { el.remove(); dequeue(); }, 300);
    }, duration);
  }

  window.ProgressionEvents.on("reward:granted", ({ def }) => {
    if (def) show({ icon: def.icon, label: def.label });
  });
  window.ProgressionEvents.on("achievement:unlocked", (def) => {
    show({ icon: "🏅", label: `Achievement: ${def.name}` });
  });
  window.ProgressionEvents.on("world:unlocked", ({ worldId }) => {
    const w = (window.WORLDS || []).find(w => w.id === worldId);
    show({ icon: "🌍", label: `World Unlocked: ${w ? w.name : worldId}` });
  });
  window.ProgressionEvents.on("difficulty:unlocked", ({ difficultyId }) => {
    const d = (window.DIFFICULTIES || []).find(d => d.id === difficultyId);
    show({ icon: "🔥", label: `Difficulty Unlocked: ${d ? d.name : difficultyId}` });
  });

  return { show };
})();
