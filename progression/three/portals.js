// three/portals.js
// Generic spinning-ring "portal" primitive used by world-portals.js for
// world unlocks and could equally be reused for difficulty unlocks.
// Stand-in for the .glb portal models in assets/models/portals/.
window.Portals = (function () {
  function makePortal({ x, y, color = "#5be36b", radius = 34, locked = false }) {
    let t = Math.random() * Math.PI * 2;
    return {
      x, y, color, radius, locked,
      update(dt) { t += dt * (locked ? 0.4 : 1.4); this._t = t; },
      draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = this.locked ? 0.35 : 1;

        for (let i = 0; i < 3; i++) {
          const rr = this.radius - i * 7;
          ctx.beginPath();
          ctx.strokeStyle = this.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = this.color;
          ctx.shadowBlur = this.locked ? 0 : 14;
          ctx.ellipse(0, 0, rr, rr * 0.4, this._t + i, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (this.locked) {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.font = "16px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("🔒", 0, 5);
        }
        ctx.restore();
      }
    };
  }

  return { makePortal };
})();
