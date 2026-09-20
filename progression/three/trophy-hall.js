// three/trophy-hall.js
// Renders the player's claimed trophy case (trophy-models.js shapes) on a
// shelf with a faux-perspective parallax background, shown inside the
// progression menu when the trophy panel is open.
window.TrophyHall = (function () {
  let canvas, ctx, container;

  function mount(targetEl) {
    container = targetEl;
    canvas = document.createElement("canvas");
    canvas.width = 260; canvas.height = 140;
    canvas.className = "prog-trophy-hall-canvas";
    container.appendChild(canvas);
    ctx = canvas.getContext("2d");
    render();
  }

  function render() {
    if (!ctx) return;
    const state = window.ProgressionManager.getState();
    const trophies = state.trophyCase || [];

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // parallax backdrop: receding shelf lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let i = 0; i < 4; i++) {
      const y = 30 + i * 28;
      ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(250, y); ctx.stroke();
    }

    const spacing = canvas.width / Math.max(1, trophies.length + 1);
    trophies.forEach((tier, i) => {
      window.TrophyModels.draw(ctx, tier, spacing * (i + 1), 100);
    });

    if (trophies.length === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "12px sans-serif";
      ctx.fillText("No trophies claimed yet", 50, 70);
    }
  }

  window.ProgressionEvents.on("trophies:case_updated", render);

  return { mount, render };
})();
