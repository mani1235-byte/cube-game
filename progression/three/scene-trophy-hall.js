// progression/three/scene-trophy-hall.js
// Full-screen 3D Trophy Hall, built on engine3d.js. A "trophy road" of all
// 11 real trophy-count milestones winds down the center of the hall, each
// showing the actual reward you get for reaching it (pulled straight from
// REWARD_TABLE) — locked/grey until reached, glowing once claimed.
// Achievements line both side walls. Click anything to inspect it.
window.TrophyHall3D = (function () {
  const E = window.Engine3D;
  const ROOM = { w: 12, d: 20, h: 5.2 };
  const TIER_COLOR = { bronze: "#cd7f32", silver: "#c8d3dc", gold: "#ffd700", diamond: "#9fe8ff" };

  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null; }

  function milestoneNodes() {
    const milestones = window.TROPHY_MILESTONES || [];
    const centerX = ROOM.w / 2;
    return milestones.map((m, i) => ({
      m,
      x: centerX + (i % 2 === 0 ? -1.5 : 1.5),
      z: 4.0 + i * 1.4
    }));
  }

  function buildStatic() {
    const faces = E.room(ROOM.w, ROOM.d, ROOM.h, { floor: "#2a1410", wallA: "#3a2418", wallB: "#4a3020", ceil: "#160d08" });
    const solids = [];
    const interactives = [];

    milestoneNodes().forEach((node) => {
      faces.push(...E.box(node.x, 0.4, node.z, 0.5, 0.4, 0.5, "#3a2818"));
      faces.push(...E.box(node.x, 0.84, node.z, 0.34, 0.06, 0.34, "#caa14a"));
      solids.push({ x: node.x, z: node.z, r: 0.62 });
      interactives.push({ id: "ms:" + node.m.id, pos: { x: node.x, y: 1.35, z: node.z }, hitRadiusPx: 56, kind: "milestone", node });
    });

    const achievements = window.ACHIEVEMENTS || [];
    const leftX = 1.15, rightX = ROOM.w - 1.15;
    achievements.forEach((a, i) => {
      const side = i % 2 === 0 ? leftX : rightX;
      const z = 2.6 + Math.floor(i / 2) * 2.6;
      faces.push(...E.box(side, 0.32, z, 0.42, 0.32, 0.42, "#3a2818"));
      solids.push({ x: side, z, r: 0.6 });
      interactives.push({ id: "ach:" + a.id, pos: { x: side, y: 1.25, z }, hitRadiusPx: 50, kind: "achievement", achievement: a });
    });

    return { faces, solids, interactives };
  }

  function buildDynamic(t) {
    const state = window.ProgressionManager.getState();
    const sprites = [];

    milestoneNodes().forEach((node, i) => {
      const m = node.m;
      const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🏆", label: m.rewardId };
      const unlocked = state.trophies >= m.trophies;
      const glow = TIER_COLOR[m.tier] || "#ffd24a";
      const bob = Math.sin(t * 1.6 + i) * 0.05;
      sprites.push({
        pos: { x: node.x, y: 1.4 + bob, z: node.z },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.font = (52 * scale) + "px sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.filter = unlocked ? "none" : "grayscale(1) brightness(0.32)";
          if (unlocked) { ctx.shadowColor = glow; ctx.shadowBlur = 22 * scale; }
          ctx.fillText(unlocked ? reward.icon : "🔒", sx, sy);
          ctx.restore();
        }
      });
      sprites.push({
        pos: { x: node.x, y: 0.5, z: node.z },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.font = Math.max(8, 12 * scale) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = unlocked ? "#fff" : "rgba(255,255,255,0.55)";
          ctx.shadowColor = "#000"; ctx.shadowBlur = 4;
          ctx.fillText(m.trophies + " 🏆", sx, sy);
          ctx.restore();
        }
      });
    });

    const achievements = window.ACHIEVEMENTS || [];
    const claimed = state.achievementsClaimed || {};
    achievements.forEach((a, i) => {
      const side = i % 2 === 0 ? 1.15 : ROOM.w - 1.15;
      const z = 2.6 + Math.floor(i / 2) * 2.6;
      const unlocked = !!claimed[a.id];
      const bob = Math.sin(t * 1.8 + i * 1.3) * 0.04;
      sprites.push({
        pos: { x: side, y: 1.25 + bob, z },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.font = (44 * scale) + "px sans-serif";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.filter = unlocked ? "none" : "grayscale(1) brightness(0.32)";
          if (unlocked) { ctx.shadowColor = "#ffd24a"; ctx.shadowBlur = 16 * scale; }
          ctx.fillText(unlocked ? "🏅" : "❔", sx, sy);
          ctx.restore();
        }
      });
    });

    return { faces: [], sprites };
  }

  function onInteract(it, api) {
    const state = window.ProgressionManager.getState();
    if (it.kind === "milestone") {
      const m = it.node.m;
      const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🏆", label: m.rewardId };
      const unlocked = state.trophies >= m.trophies;
      const claimedAt = state.trophyMilestonesClaimed && state.trophyMilestonesClaimed[m.id] && state.trophyMilestonesClaimed[m.id].at;
      api.showPanel(`
        <div class="e3d-panel-title">${unlocked ? reward.icon : "🔒"} ${reward.label}</div>
        <div class="e3d-panel-desc">${unlocked ? "Earned — this was granted automatically when you reached this milestone." : "Reach this many trophies to earn it."}</div>
        <div class="e3d-panel-meta">
          <span>Requirement: ${m.trophies} trophies (you have ${state.trophies})</span>
          ${unlocked ? `<span>Date unlocked: ${fmtDate(claimedAt) || "—"}</span>` : `<span class="e3d-panel-locked">🔒 Locked</span>`}
        </div>
      `);
    } else {
      const a = it.achievement;
      const unlocked = !!((state.achievementsClaimed || {})[a.id]);
      const dateAt = (state.achievementDates || {})[a.id];
      api.showPanel(`
        <div class="e3d-panel-title">${unlocked ? "🏅" : "❔"} ${unlocked ? a.name : "???"}</div>
        <div class="e3d-panel-desc">${unlocked ? a.desc : "Keep playing to discover this achievement."}</div>
        <div class="e3d-panel-meta">
          <span>Requirement: ${a.desc}</span>
          ${unlocked ? `<span>Date unlocked: ${fmtDate(dateAt) || "—"}</span>` : `<span class="e3d-panel-locked">🔒 Locked</span>`}
        </div>
      `);
    }
  }

  function open() {
    return E.openScene({
      title: "🏛️ Trophy Hall",
      hint: "WASD/drag to look · click any trophy to see what it rewards",
      roomSize: ROOM,
      spawn: { x: ROOM.w / 2, z: 1.4, yaw: 0 },
      voidColor: "#0a0603",
      buildStatic,
      buildDynamic,
      onInteract
    });
  }

  return { open };
})();
