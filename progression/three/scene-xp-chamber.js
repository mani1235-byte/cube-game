// progression/three/scene-xp-chamber.js
// Full-screen 3D XP Crystal Chamber. A floating crystal sits at the
// center of the room; its inner energy core grows with progress toward
// the next level, with light beams + orbiting particles scaling along
// with it. An inner sapphire ring of plaques marks level-title milestones
// (10/20/30); an outer gold ring of pedestals — same "locked/grey until
// reached, glowing once claimed" treatment as the Trophy Hall — marks the
// full LEVEL_MILESTONES reward path (1/5/10/20/30/50/75/100), each showing
// the actual reward pulled from REWARD_TABLE. Click anything for details.
window.XPChamber3D = (function () {
  const E = window.Engine3D;
  const ROOM = { w: 11, d: 11, h: 6.4 };
  const CENTER = { x: ROOM.w / 2, z: ROOM.d / 2 };
  const CRYSTAL_Y = 2.6;
  const TIER_COLOR = { bronze: "#cd7f32", silver: "#c8d3dc", gold: "#ffd700", diamond: "#9fe8ff" };

  function titleMilestones() {
    return (window.XP_LEVELS || []).filter(l => l.title);
  }

  function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : null; }

  function levelRewardNodes() {
    // Outer ring, offset 22.5° from the cardinal directions so the pedestals
    // don't sit on top of the mid-wall energy pillars.
    const milestones = window.LEVEL_MILESTONES || [];
    const radius = 4.8;
    return milestones.map((m, i) => {
      const angle = (i / Math.max(1, milestones.length)) * Math.PI * 2 - Math.PI / 2 + (Math.PI / 8);
      return { m, x: CENTER.x + Math.cos(angle) * radius, z: CENTER.z + Math.sin(angle) * radius };
    });
  }

  function buildStatic() {
    // 💎 XP Crystal Chamber — midnight cosmic sapphire
    const faces = E.room(ROOM.w, ROOM.d, ROOM.h, {
      floor: "#050818",   // deep midnight-blue floor
      wallA: "#080e28",   // rich deep-space blue back/front walls
      wallB: "#060c22",   // slightly darker side walls
      ceil:  "#02040f"    // near-void ceiling
    });
    // ── Pulsing energy ring on floor around crystal ───────────────────────
    faces.push(...E.ring(CENTER.x, 0.01, CENTER.z, 3.2, 2.8, 24, "#0a2a6e", { emissive: true, glow: "#2255ff", alpha: 0.5 }));
    faces.push(...E.ring(CENTER.x, 0.01, CENTER.z, 2.0, 1.7, 24, "#1133aa", { emissive: true, glow: "#4477ff", alpha: 0.6 }));
    faces.push(...E.ring(CENTER.x, 0.01, CENTER.z, 1.1, 0.85, 16, "#1a44cc", { emissive: true, glow: "#66aaff", alpha: 0.7 }));
    // ── 8 corner energy pillars ───────────────────────────────────────────
    const pillarPositions = [
      [1.0, 1.0], [ROOM.w-1.0, 1.0], [1.0, ROOM.d-1.0], [ROOM.w-1.0, ROOM.d-1.0],
      [1.0, ROOM.d/2], [ROOM.w-1.0, ROOM.d/2], [ROOM.w/2, 1.0], [ROOM.w/2, ROOM.d-1.0]
    ];
    pillarPositions.forEach(([px, pz], i) => {
      const hue = 200 + (i * 20) % 80;
      faces.push(...E.box(px, ROOM.h/2, pz, 0.14, ROOM.h/2, 0.14, `hsl(${hue},80%,25%)`, { emissive: true, glow: `hsl(${hue},100%,65%)`, alpha: 0.6 }));
      // pillar top glow cap
      faces.push(...E.box(px, ROOM.h - 0.1, pz, 0.28, 0.1, 0.28, `hsl(${hue},90%,55%)`, { emissive: true, glow: `hsl(${hue},100%,75%)`, alpha: 0.75 }));
    });
    // ── Ceiling central energy beacon ─────────────────────────────────────
    faces.push(...E.box(CENTER.x, ROOM.h - 0.04, CENTER.z, 1.6, 0.06, 1.6, "#0a1a88", { emissive: true, glow: "#3366ff", alpha: 0.45 }));
    faces.push(...E.box(CENTER.x, ROOM.h - 0.04, CENTER.z, 0.7, 0.07, 0.7, "#2244cc", { emissive: true, glow: "#88aaff", alpha: 0.6 }));
    // ── Hexagonal floor tile glows ────────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = 4.0;
      const hx = CENTER.x + Math.cos(a) * r;
      const hz = CENTER.z + Math.sin(a) * r;
      faces.push(...E.box(hx, 0.005, hz, 0.18, 0.004, 0.18, "#0044aa", { emissive: true, glow: "#0088ff", alpha: 0.6 }));
    }

    const solids = [{ x: CENTER.x, z: CENTER.z, r: 1.5 }];
    const interactives = [];

    const milestones = titleMilestones();
    const radius = 4.1;
    milestones.forEach((m, i) => {
      const angle = (i / Math.max(1, milestones.length)) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + Math.cos(angle) * radius;
      const z = CENTER.z + Math.sin(angle) * radius;
      // glowing sapphire plinth base
      faces.push(...E.box(x, 0.4, z, 0.36, 0.4, 0.36, "#0a1a55", { emissive: true, glow: "#2255cc", alpha: 0.8 }));
      // small glow cap
      faces.push(...E.box(x, 0.82, z, 0.28, 0.04, 0.28, "#2255ff", { emissive: true, glow: "#88aaff", alpha: 0.9 }));
      solids.push({ x, z, r: 0.55 });
      interactives.push({ id: "ms:" + m.level, pos: { x, y: 1.55, z }, hitRadiusPx: 56, kind: "milestone", milestone: m });
    });

    levelRewardNodes().forEach((node) => {
      // glowing gold pedestal — same treatment as the Trophy Hall's reward road
      faces.push(...E.box(node.x, 0.4, node.z, 0.5, 0.4, 0.5, "#3a2e0e", { emissive: true, glow: "#cc9a2a", alpha: 0.5 }));
      faces.push(...E.box(node.x, 0.84, node.z, 0.34, 0.06, 0.34, "#caa14a", { emissive: true, glow: "#ffd060", alpha: 0.9 }));
      solids.push({ x: node.x, z: node.z, r: 0.62 });
      interactives.push({ id: "lvl:" + node.m.id, pos: { x: node.x, y: 1.35, z: node.z }, hitRadiusPx: 56, kind: "levelReward", node });
    });

    return { faces, solids, interactives };
  }

  function buildDynamic(t) {
    const p = window.XPSystem.getProgress();
    const progress = Math.max(0.04, p.progress);
    const faces = [];

    // outer translucent shell (always visible, fixed size)
    faces.push(...E.bipyramid(CENTER.x, CRYSTAL_Y, CENTER.z, 0.95, 1.7, "#5a3fc9", { emissive: true, doubleSided: true, alpha: 0.22 }));

    // inner energy core — grows with progress toward next level
    const coreR = 0.18 + progress * 0.78, coreH = 0.35 + progress * 1.35;
    const hue = Math.round(260 - progress * 100); // purple -> cyan as it fills
    const coreColor = `hsl(${hue},85%,68%)`;
    faces.push(...E.bipyramid(CENTER.x, CRYSTAL_Y, CENTER.z, coreR, coreH, coreColor, { emissive: true, doubleSided: true, glow: coreColor }));

    // light beams shooting up from the crystal, count scales with progress
    const beamCount = 2 + Math.round(progress * 5);
    for (let i = 0; i < beamCount; i++) {
      const a = (i / beamCount) * Math.PI * 2 + t * 0.4;
      const bx = CENTER.x + Math.cos(a) * 0.45, bz = CENTER.z + Math.sin(a) * 0.45;
      const flick = 0.55 + 0.45 * Math.sin(t * 4 + i);
      faces.push(...E.box(bx, ROOM.h / 2, bz, 0.045, ROOM.h / 2 - 0.2, 0.045, coreColor, { emissive: true, alpha: 0.25 * flick }));
    }

    // orbiting particles
    const sprites = [];
    const particleCount = 6 + Math.round(progress * 18);
    for (let i = 0; i < particleCount; i++) {
      const a = t * (0.6 + (i % 3) * 0.15) + i * 1.7;
      const r = 1.3 + (i % 4) * 0.32;
      const y = CRYSTAL_Y + Math.sin(t * 1.3 + i) * 0.9;
      const x = CENTER.x + Math.cos(a) * r, z = CENTER.z + Math.sin(a) * r;
      sprites.push({
        pos: { x, y, z },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.fillStyle = coreColor;
          ctx.shadowColor = coreColor;
          ctx.shadowBlur = 10 * scale;
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(1.2, 3 * scale), 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // level + progress label floating above the crystal
    sprites.push({
      pos: { x: CENTER.x, y: CRYSTAL_Y + 2.0, z: CENTER.z },
      draw(ctx, sx, sy, scale) {
        ctx.save();
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#000"; ctx.shadowBlur = 6;
        ctx.font = Math.max(11, 22 * scale) + "px sans-serif";
        ctx.fillText("Lv " + p.level, sx, sy);
        ctx.font = Math.max(9, 14 * scale) + "px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fillText(p.xpIntoLevel + " / " + p.xpForNextLevel + " XP", sx, sy + 18 * scale);
        ctx.restore();
      }
    });

    // milestone plaque icons
    const milestones = titleMilestones();
    const state = window.ProgressionManager.getState();
    const radius = 4.1;
    milestones.forEach((m, i) => {
      const angle = (i / Math.max(1, milestones.length)) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + Math.cos(angle) * radius;
      const z = CENTER.z + Math.sin(angle) * radius;
      const unlocked = state.level >= m.level;
      const bob = Math.sin(t * 1.5 + i) * 0.08;
      sprites.push({
        pos: { x, y: 1.55 + bob, z },
        draw(ctx, sx, sy, scale) {
          ctx.save();
          ctx.font = (46 * scale) + "px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.filter = unlocked ? "none" : "grayscale(1) brightness(0.32)";
          if (unlocked) { ctx.shadowColor = "#ffd24a"; ctx.shadowBlur = 20 * scale; }
          ctx.fillText(unlocked ? "⭐" : "🔒", sx, sy);
          ctx.restore();
        }
      });
    });

    levelRewardNodes().forEach((node, i) => {
      const m = node.m;
      const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🏆", label: m.rewardId };
      const unlocked = state.level >= m.level;
      const glow = TIER_COLOR[m.tier] || "#ffd24a";
      const bob = Math.sin(t * 1.6 + i + 10) * 0.05;
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
          ctx.fillText("Lv " + m.level, sx, sy);
          ctx.restore();
        }
      });
    });

    return { faces, sprites };
  }

  function onInteract(it, api) {
    const state = window.ProgressionManager.getState();
    if (it.kind === "levelReward") {
      const m = it.node.m;
      const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🏆", label: m.rewardId };
      const unlocked = state.level >= m.level;
      const claimedAt = state.levelMilestonesClaimed && state.levelMilestonesClaimed[m.id] && state.levelMilestonesClaimed[m.id].at;
      api.showPanel(`
        <div class="e3d-panel-title">${unlocked ? reward.icon : "🔒"} ${reward.label}</div>
        <div class="e3d-panel-desc">${unlocked ? "Earned — this was granted automatically when you reached this level." : "Reach this level to earn it."}</div>
        <div class="e3d-panel-meta">
          <span>Requirement: Level ${m.level} (you're Level ${state.level})</span>
          ${unlocked ? `<span>Date unlocked: ${fmtDate(claimedAt) || "—"}</span>` : `<span class="e3d-panel-locked">🔒 Locked</span>`}
        </div>
      `);
      return;
    }
    if (it.kind !== "milestone") return;
    const m = it.milestone;
    const unlocked = state.level >= m.level;
    api.showPanel(`
      <div class="e3d-panel-title">⭐ ${m.title}</div>
      <div class="e3d-panel-desc">${unlocked ? "Title earned." : "Reach this level to earn the title."}</div>
      <div class="e3d-panel-meta">
        <span>Requirement: Reach Level ${m.level}</span>
        <span>Current level: ${state.level}</span>
        ${!unlocked ? `<span class="e3d-panel-locked">🔒 Locked</span>` : ""}
      </div>
    `);
  }

  function open() {
    return E.openScene({
      title: "💎 XP Crystal Chamber",
      hint: "Walk around the crystal · click a plaque for level titles, or a gold pedestal for level rewards",
      roomSize: ROOM,
      spawn: { x: CENTER.x, z: 1.3, yaw: 0 },
      voidColor: "#010208",
      buildStatic,
      buildDynamic,
      onInteract
    });
  }

  return { open };
})();
