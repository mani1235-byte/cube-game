// three/reward-room.js
// A brief radial "reward room" glow burst behind the reward toast whenever
// a high-value reward (world/difficulty/legendary chest) is granted, to
// give big moments more weight than the standard toast alone.
window.RewardRoom = (function () {
  function burst(color = "#ffd24a") {
    const start = performance.now();
    const duration = 900;
    window.ProgressionScene.registerLayer({
      id: "reward-room-burst-" + start,
      update() {},
      draw(ctx) {
        const t = (performance.now() - start) / duration;
        if (t >= 1) { window.ProgressionScene.unregisterLayer("reward-room-burst-" + start); return; }
        const r = window.ProgressionMath.easeOutCubic(t) * Math.max(window.innerWidth, window.innerHeight) * 0.6;
        const alpha = 0.35 * (1 - t);
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, color + "00");
        grad.addColorStop(0.85, color + Math.round(alpha * 255).toString(16).padStart(2, "0"));
        grad.addColorStop(1, color + "00");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      }
    });
  }

  window.ProgressionEvents.on("world:unlocked", () => burst("#5be36b"));
  window.ProgressionEvents.on("difficulty:unlocked", () => burst("#ff5a3c"));
  window.ProgressionEvents.on("reward:granted", ({ rewardId }) => {
    if (rewardId === "chest_legendary" || rewardId === "trophy_diamond") burst("#ff5fd1");
  });

  return { burst };
})();
