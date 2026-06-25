// progression/three/scene-world-portals.js
// Full-screen 3D World Portal Room. One real ring portal per entry in
// WORLDS, lined up along the back wall. Locked portals are dim with a
// lock icon and show their requirement; unlocked portals shimmer and can
// be walked into (or clicked, which auto-walks you in) to travel.
window.WorldPortals3D = (function () {
  const E = window.Engine3D;

  function requirementText(w) {
    if (!w.requirement) return "Unlocked from the start";
    if (w.requirement.type === "trophies") return `Reach ${w.requirement.value} trophies`;
    if (w.requirement.type === "rewardId") {
      const def = (window.REWARD_TABLE || {})[w.requirement.value];
      return def ? `Obtain: ${def.label}` : "Special reward required";
    }
    return "Unknown requirement";
  }

  function swirlFaces(cx, cy, cz, r, seg, baseHue, t, locked, alpha) {
    const faces = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r, z: cz };
      const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r, z: cz };
      const center = { x: cx, y: cy, z: cz };
      const hue = locked ? 0 : (baseHue + i * (360 / seg) + t * 50) % 360;
      const color = locked ? "#102a5c" : `hsl(${hue},75%,60%)`;
      faces.push({ verts: [center, p0, p1], normal: { x: 0, y: 0, z: 1 }, color, emissive: !locked, doubleSided: true, alpha: alpha != null ? alpha : 1 });
    }
    return faces;
  }

  function ringFaces(cx, cy, cz, rOuter, rInner, seg, color, opts) {
    return E.ring(cx, cy, cz, rOuter, rInner, seg, color, opts);
  }

  function open() {
    const worlds = window.WORLDS || [];
    const ROOM = { w: Math.max(10, worlds.length * 3 + 2), d: 10, h: 5.2 };
    const z = ROOM.d - 2.0;
    const spacing = (ROOM.w - 2) / Math.max(1, worlds.length);
    const positions = worlds.map((w, i) => ({ w, x: 1 + spacing * (i + 0.5), z }));

    let api;
    let travelling = false;

    function buildStatic() {
      const faces = E.room(ROOM.w, ROOM.d, ROOM.h, { floor: "#11142b", wallA: "#181c3c", wallB: "#1f2449", ceil: "#070815" });
      const interactives = [];
      // no solids here — portals are meant to be walked *through* to travel,
      // so they must never block the player from reaching their exact position
      positions.forEach((p) => {
        interactives.push({ id: "world:" + p.w.id, pos: { x: p.x, y: 1.6, z: p.z }, hitRadiusPx: 70, kind: "world", world: p.w, anchor: p });
      });
      return { faces, solids: [], interactives };
    }

    function buildDynamic(t) {
      const faces = [];
      const sprites = [];
      positions.forEach((p) => {
        const unlocked = window.WorldSystem.isUnlocked(p.w.id);
        faces.push(...ringFaces(p.x, 1.6, p.z, 1.18, 0.95, 18, unlocked ? p.w.portalColor : "#33333c", { emissive: true, glow: unlocked ? p.w.portalColor : null, alpha: unlocked ? 1 : 0.6 }));
        const baseHue = (p.w.portalColor.charCodeAt(1) * 7) % 360;
        faces.push(...swirlFaces(p.x, 1.6, p.z - 0.015, 0.9, 16, baseHue, t, !unlocked, unlocked ? 0.85 : 0.3));

        sprites.push({
          pos: { x: p.x, y: 3.1, z: p.z },
          draw(ctx, sx, sy, scale) {
            ctx.save();
            ctx.textAlign = "center";
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000"; ctx.shadowBlur = 5;
            ctx.font = Math.max(10, 16 * scale) + "px sans-serif";
            ctx.fillText((unlocked ? "" : "🔒 ") + p.w.name, sx, sy);
            ctx.restore();
          }
        });
      });
      return { faces, sprites };
    }

    function onInteract(it) {
      if (travelling) return;
      const w = it.world;
      const unlocked = window.WorldSystem.isUnlocked(w.id);
      if (!unlocked) {
        api.showPanel(`
          <div class="e3d-panel-title">🔒 ${w.name}</div>
          <div class="e3d-panel-desc">This portal hasn't opened yet.</div>
          <div class="e3d-panel-meta"><span>Requirement: ${requirementText(w)}</span></div>
        `);
        return;
      }
      api.hidePanel();
      travelling = true;
      api.walkTo(it.anchor.x, it.anchor.z, () => {
        window.WorldSystem.travelTo(w.id);
        api.toast(`🌍 Travelled to ${w.name}`, 1800);
        setTimeout(() => api.close(), 1500);
      });
    }

    api = E.openScene({
      title: "🌍 World Portal Room",
      hint: "WASD to walk · click a glowing portal to travel",
      roomSize: ROOM,
      spawn: { x: ROOM.w / 2, z: 1.2, yaw: 0 },
      voidColor: "#05060a",
      buildStatic,
      buildDynamic,
      onInteract
    });
    return api;
  }

  return { open };
})();
