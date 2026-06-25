// progression/three/scene-brawl-pass.js
// Full-screen 3D Brawl Pass Room: a long corridor with all 70 pass tiers
// laid out in order. You spawn near your *actual* current tier (not at
// tier 1 every time) with a glowing "you are here" floor marker. Walk
// forward for upcoming tiers, look back for ones you've already passed.
// Tier rewards come straight from PASS_TRACK / REWARD_TABLE — claiming
// already happens automatically via pass-system.js as XP is earned; this
// room is purely a window into that real progress.
window.BrawlPassRoom3D = (function () {
  const E = window.Engine3D;
  const Z0 = 3.0, SPACING = 2.0, AMP = 0.8;
  const CENTER_X = 4;

  function nodeZ(tier) { return Z0 + (tier - 1) * SPACING; }
  function nodeX(tier) { return CENTER_X + (tier % 2 === 0 ? AMP : -AMP); }

  function open() {
    const track = window.PASS_TRACK || [];
    const ROOM = { w: 8, d: Z0 + track.length * SPACING + 4, h: 4.6 };

    let api;

    function buildStatic() {
      const faces = E.room(ROOM.w, ROOM.d, ROOM.h, { floor: "#24103d", wallA: "#5c2d91", wallB: "#7c4dbe", ceil: "#12081f" });
      const solids = [];
      const interactives = [];

      track.forEach((t) => {
        const x = nodeX(t.tier), z = nodeZ(t.tier);
        const big = t.tier % 10 === 0;
        const half = big ? 0.42 : 0.3;
        faces.push(...E.box(x, half, z, half, half, half, "#2a1d3a"));
        solids.push({ x, z, r: half + 0.2 });
        interactives.push({ id: "tier:" + t.tier, pos: { x, y: half * 2 + 0.35, z }, hitRadiusPx: big ? 60 : 52, kind: "tier", t });
      });

      return { faces, solids, interactives };
    }

    function buildDynamic(t) {
      const state = window.ProgressionManager.getState();
      const progress = window.PassSystem.getProgress();
      const sprites = [];
      const faces = [];

      track.forEach((node, i) => {
        const x = nodeX(node.tier), z = nodeZ(node.tier);
        const reward = (window.REWARD_TABLE || {})[node.rewardId] || { icon: "🎁", label: node.rewardId };
        const unlocked = state.xp >= node.xpRequired;
        const big = node.tier % 10 === 0;
        const glow = node.rewardId.startsWith("chest") ? "#ffd24a" : "#9fe8ff";
        const bob = Math.sin(t * 1.6 + i * 0.7) * 0.05;
        const half = big ? 0.42 : 0.3;
        sprites.push({
          pos: { x, y: half * 2 + 0.5 + bob, z },
          draw(ctx, sx, sy, scale) {
            ctx.save();
            ctx.font = ((big ? 58 : 44) * scale) + "px sans-serif";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.filter = unlocked ? "none" : "grayscale(1) brightness(0.32)";
            if (unlocked) { ctx.shadowColor = glow; ctx.shadowBlur = (big ? 26 : 18) * scale; }
            ctx.fillText(unlocked ? reward.icon : "🔒", sx, sy);
            ctx.restore();
          }
        });
        sprites.push({
          pos: { x, y: 0.12, z },
          draw(ctx, sx, sy, scale) {
            ctx.save();
            ctx.font = Math.max(8, 11 * scale) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = unlocked ? "#fff" : "rgba(255,255,255,0.5)";
            ctx.shadowColor = "#000"; ctx.shadowBlur = 4;
            ctx.fillText("Tier " + node.tier, sx, sy);
            ctx.restore();
          }
        });
      });

      // "you are here" marker — interpolated between the current and next tier
      const curZ = progress.tier > 0 ? nodeZ(progress.tier) : Z0 - SPACING;
      const curX = progress.tier > 0 ? nodeX(progress.tier) : CENTER_X;
      const nextZ = progress.next ? nodeZ(progress.next.tier) : curZ;
      const nextX = progress.next ? nodeX(progress.next.tier) : curX;
      const markerX = curX + (nextX - curX) * progress.progress;
      const markerZ = curZ + (nextZ - curZ) * progress.progress;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3);
      faces.push(...E.ring(markerX, 0.02, markerZ, 0.7 + pulse * 0.08, 0.4, 16, "#ff4d8d", { emissive: true, doubleSided: true, alpha: 0.55 }));
      sprites.push({
        pos: { x: markerX, y: 1.7, z: markerZ },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.font = Math.max(9, 13 * scale) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "#ff4d8d";
          ctx.shadowColor = "#000"; ctx.shadowBlur = 5;
          ctx.fillText("📍 YOU ARE HERE", sx, sy);
          ctx.restore();
        }
      });

      return { faces, sprites };
    }

    function onInteract(it, apiRef) {
      const node = it.t;
      const state = window.ProgressionManager.getState();
      const reward = (window.REWARD_TABLE || {})[node.rewardId] || { icon: "🎁", label: node.rewardId };
      const unlocked = state.xp >= node.xpRequired;
      const claimedAt = state.passTiersClaimed && state.passTiersClaimed[node.tier] && state.passTiersClaimed[node.tier].at;
      apiRef.showPanel(`
        <div class="e3d-panel-title">${unlocked ? reward.icon : "🔒"} Tier ${node.tier}: ${reward.label}</div>
        <div class="e3d-panel-desc">${unlocked ? "Earned — granted automatically when you reached this tier." : "Keep earning XP to reach this tier."}</div>
        <div class="e3d-panel-meta">
          <span>Requirement: ${node.xpRequired} total XP (you have ${state.xp})</span>
          ${unlocked ? `<span>Date unlocked: ${claimedAt ? new Date(claimedAt).toLocaleDateString() : "—"}</span>` : `<span class="e3d-panel-locked">🔒 Locked</span>`}
        </div>
      `);
    }

    const progress0 = window.PassSystem.getProgress();
    const targetTier = Math.max(1, progress0.tier);
    const targetZ = nodeZ(targetTier);
    const spawnZ = Math.max(1.2, targetZ - 3.0);

    api = E.openScene({
      title: `🎫 Brawl Pass — Tier ${progress0.tier} / ${progress0.maxTier}`,
      hint: "WASD to walk · click a tier to inspect it",
      roomSize: ROOM,
      spawn: { x: CENTER_X, z: spawnZ, yaw: 0 },
      voidColor: "#08050c",
      buildStatic,
      buildDynamic,
      onInteract
    });
    return api;
  }

  return { open };
})();
