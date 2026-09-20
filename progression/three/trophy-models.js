// three/trophy-models.js
// Draws a stylized trophy cup shape per tier. Stand-in for the .glb
// models referenced in assets/models/trophies/ until a real 3D renderer
// is wired into the project.
window.TrophyModels = (function () {
  const TIER_COLORS = {
    bronze: "#cd7f32",
    silver: "#c0c0c0",
    gold: "#ffd700",
    diamond: "#9fe8ff"
  };

  function draw(ctx, tier, x, y) {
    const color = TIER_COLORS[tier] || "#ffffff";
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // cup
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-12, -28);
    ctx.quadraticCurveTo(-14, -8, 0, -4);
    ctx.quadraticCurveTo(14, -8, 12, -28);
    ctx.closePath();
    ctx.fill();

    // stem + base
    ctx.fillRect(-3, -4, 6, 10);
    ctx.fillRect(-10, 6, 20, 4);

    // handles
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-14, -20, 5, -Math.PI * 0.6, Math.PI * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, -20, 5, Math.PI * 0.4, Math.PI * 1.6); ctx.stroke();

    ctx.restore();
  }

  return { draw, TIER_COLORS };
})();
