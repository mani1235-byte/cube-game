// three/coin-particles.js
// Small coin-colored particle burst, fired from the coin counter whenever
// coins are earned, and reusable by reward-effects.js for "confetti".
window.CoinParticles = (function () {
  function burst(x, y, count = 16, color = "#ffd24a") {
    const particles = Array.from({ length: count }, () => ({
      x, y,
      vx: (Math.random() - 0.5) * 220,
      vy: -Math.random() * 260 - 60,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4
    }));

    window.ProgressionScene.registerLayer({
      id: "coin-particles-" + Date.now() + Math.random(),
      update(dt) {
        particles.forEach(p => {
          p.life += dt;
          p.vy += 600 * dt; // gravity
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        });
        if (particles.every(p => p.life >= p.maxLife)) {
          window.ProgressionScene.unregisterLayer(this.id);
        }
      },
      draw(ctx) {
        particles.forEach(p => {
          if (p.life >= p.maxLife) return;
          const alpha = 1 - p.life / p.maxLife;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }
    });
  }

  window.ProgressionEvents.on("coins:earned", () => {
    const el = document.getElementById("prog-coin-counter");
    if (!el) return;
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 10);
  });

  return { burst };
})();
