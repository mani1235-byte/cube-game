// progression/three/scene-xp-chamber.js
// Full-screen 3D XP Crystal Chamber. A floating crystal sits at the
// center of the room; its inner energy core grows with progress toward
// the next level, with light beams + orbiting particles scaling along
// with it. Floating plaques around the room mark level-title milestones
// (10/20/30) and can be walked up to / clicked for details.
window.XPChamber3D = (function () {
  const E = window.Engine3D;
  const ROOM = { w: 11, d: 11, h: 6.4 };
  const CENTER = { x: ROOM.w / 2, z: ROOM.d / 2 };
  const CRYSTAL_Y = 2.6;

  function titleMilestones() {
    return (window.XP_LEVELS || []).filter(l => l.title);
  }

  function buildStatic() {
    const faces = E.room(ROOM.w, ROOM.d, ROOM.h, { floor: "#081c3a", wallA: "#0f3d7a", wallB: "#1a5fb4", ceil: "#04101f" });
    const solids = [{ x: CENTER.x, z: CENTER.z, r: 1.5 }];
    const interactives = [];

    const milestones = titleMilestones();
    const radius = 4.1;
    milestones.forEach((m, i) => {
      const angle = (i / Math.max(1, milestones.length)) * Math.PI * 2 - Math.PI / 2;
      const x = CENTER.x + Math.cos(angle) * radius;
      const z = CENTER.z + Math.sin(angle) * radius;
      faces.push(...E.box(x, 0.4, z, 0.36, 0.4, 0.36, "#221c38"));
      solids.push({ x, z, r: 0.55 });
      interactives.push({ id: "ms:" + m.level, pos: { x, y: 1.55, z }, hitRadiusPx: 56, kind: "milestone", milestone: m });
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

    return { faces, sprites };
  }

  function onInteract(it, api) {
    if (it.kind !== "milestone") return;
    const m = it.milestone;
    const state = window.ProgressionManager.getState();
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
      hint: "Walk around the crystal · click a star plaque for level titles",
      roomSize: ROOM,
      spawn: { x: CENTER.x, z: 1.3, yaw: 0 },
      voidColor: "#04030a",
      buildStatic,
      buildDynamic,
      onInteract
    });
  }

  return { open };
})();
