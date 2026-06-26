// three/chest-model.js
// Visual companion to chest3d.js's physics stub: draws a chest as a
// pseudo-3D box (top-face skew for depth) and plays a shake -> pop -> lid
// open sequence when ChestAnimation.play() fires.
window.ChestModel3D = (function () {
  let active = null; // { chestId, def, t, duration, x, y, phase }

  function playOpenSequence(chestId, duration) {
    const def = window.CHEST_TABLE[chestId];
    if (!def) return;
    active = {
      chestId, def, t: 0, duration,
      x: window.innerWidth / 2, y: window.innerHeight / 2 - 60,
      phase: "shake"
    };
    window.ProgressionScene.registerLayer({
      id: "chest-model-active",
      update(dt) {
        active.t += dt * 1000;
        if (active.t > duration * 0.6) active.phase = "pop";
        if (active.t > duration) {
          window.ProgressionScene.unregisterLayer("chest-model-active");
          active = null;
        }
      },
      draw(ctx) { if (active) drawChest(ctx, active); }
    });
  }

  function drawChest(ctx, a) {
    const shakeAmt = a.phase === "shake" ? Math.sin(a.t * 0.08) * 6 : 0;
    const popScale = a.phase === "pop" ? 1 + Math.min(0.4, (a.t - a.duration * 0.6) / (a.duration * 0.4) * 0.4) : 1;

    ctx.save();
    ctx.translate(a.x + shakeAmt, a.y);
    ctx.scale(popScale, popScale);

    // glow
    ctx.shadowColor = a.def.glow;
    ctx.shadowBlur = 30;

    // body
    ctx.fillStyle = a.def.color;
    ctx.fillRect(-50, -20, 100, 60);

    // lid (skewed top face for a cheap 3D look)
    ctx.beginPath();
    ctx.moveTo(-50, -20);
    ctx.lineTo(-35, -45);
    ctx.lineTo(35, -45);
    ctx.lineTo(50, -20);
    ctx.closePath();
    ctx.fillStyle = a.def.glow;
    ctx.fill();

    // latch
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-6, -10, 12, 20);

    ctx.restore();
  }

  return { playOpenSequence };
})();
