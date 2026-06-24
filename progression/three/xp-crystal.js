// three/xp-crystal.js
// A small floating crystal rendered next to the XP bar that pulses on
// every xp:gained event. Uses math3d.js's float() helper for the bob.
window.XPCrystal = (function () {
  let t = 0;
  let pulse = 0;

  function start() {
    window.ProgressionScene.registerLayer({
      id: "xp-crystal",
      update(dt) { t += dt; pulse = Math.max(0, pulse - dt * 2); },
      draw(ctx) {
        const bar = document.getElementById("prog-xp-bar");
        if (!bar) return;
        const rect = bar.getBoundingClientRect();
        const bob = window.Math3D.float(t, 4, 3);
        const x = rect.left - 18;
        const y = rect.top + rect.height / 2 + bob;
        const scale = 1 + pulse * 0.5;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * 0.6);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#7a5bff";
        ctx.shadowColor = "#9d8bff";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
  }

  window.ProgressionEvents.on("progression:ready", start);
  window.ProgressionEvents.on("xp:gained", () => { pulse = 1; });

  return {};
})();
