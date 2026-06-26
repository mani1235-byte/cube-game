// progression/three/engine3d.js
//
// A real, from-scratch 3D engine: plain vector/trig math + a software
// rasterizer that paints flat-shaded polygons back-to-front onto a single
// 2D canvas. No three.js, no WebGL — see progression/assets/README.md for
// why this project stays on a raw-math pipeline.
//
// This file owns:
//   - vector math + camera projection / inverse-projection (screen -> ray)
//   - geometry builders: room(), box(), ring(), bipyramid()
//   - a full-screen "scene" runner: canvas + DOM chrome, WASD movement,
//     drag-to-look, click-to-walk, click-to-interact, touch support
//
// progression/three/scene-*.js files call Engine3D.openScene({...}) to get
// a complete walkable room; they only describe geometry + behavior.
window.Engine3D = (function () {

  // ---------------- vector math ----------------
  const Vec = {
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s }),
    dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    len: (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z),
    norm: (a) => { const l = Vec.len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; },
    lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })
  };

  function rotY(v, a) { const c = Math.cos(a), s = Math.sin(a); return { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c }; }
  function rotX(v, a) { const c = Math.cos(a), s = Math.sin(a); return { x: v.x, y: v.y * c - v.z * s, z: v.y * s + v.z * c }; }

  // World point -> camera-space point. cam = {x,y,z,yaw,pitch}.
  function toCameraSpace(cam, p) {
    const rel = Vec.sub(p, cam);
    return rotX(rotY(rel, -cam.yaw), -cam.pitch);
  }

  // Camera-space point -> screen point. Returns null if behind the near plane.
  function projectCam(c, fScale, w, h) {
    if (c.z <= 0.08) return null;
    return { x: w / 2 + (c.x / c.z) * fScale, y: h / 2 - (c.y / c.z) * fScale, depth: c.z };
  }

  function fovScale(fovDeg, h) { return (h / 2) / Math.tan((fovDeg * Math.PI) / 360); }

  // Screen point -> world-space ray direction (for floor / object picking).
  function screenToRay(cam, fScale, sx, sy, w, h) {
    const cs = { x: (sx - w / 2) / fScale, y: (h / 2 - sy) / fScale, z: 1 };
    const afterPitch = rotX(cs, cam.pitch);
    const world = rotY(afterPitch, cam.yaw);
    return Vec.norm(world);
  }

  // ---------------- geometry builders ----------------
  // Each face: { verts:[{x,y,z}...3+ planar, convex, cyclic order], normal:{x,y,z}, color:'#rrggbb',
  //             emissive?:bool, glow?:'#rrggbb', alpha?:0..1, doubleSided?:bool }

  function room(w, d, h, colors) {
    const c = Object.assign({ floor: "#1b1d2a", ceil: "#13141d", wallA: "#22243a", wallB: "#262842" }, colors || {});
    return [
      { verts: [{ x: 0, y: 0, z: 0 }, { x: w, y: 0, z: 0 }, { x: w, y: 0, z: d }, { x: 0, y: 0, z: d }], normal: { x: 0, y: 1, z: 0 }, color: c.floor },
      { verts: [{ x: 0, y: h, z: 0 }, { x: 0, y: h, z: d }, { x: w, y: h, z: d }, { x: w, y: h, z: 0 }], normal: { x: 0, y: -1, z: 0 }, color: c.ceil },
      { verts: [{ x: 0, y: 0, z: 0 }, { x: 0, y: h, z: 0 }, { x: w, y: h, z: 0 }, { x: w, y: 0, z: 0 }], normal: { x: 0, y: 0, z: 1 }, color: c.wallA },
      { verts: [{ x: 0, y: 0, z: d }, { x: w, y: 0, z: d }, { x: w, y: h, z: d }, { x: 0, y: h, z: d }], normal: { x: 0, y: 0, z: -1 }, color: c.wallA },
      { verts: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: d }, { x: 0, y: h, z: d }, { x: 0, y: h, z: 0 }], normal: { x: 1, y: 0, z: 0 }, color: c.wallB },
      { verts: [{ x: w, y: 0, z: 0 }, { x: w, y: h, z: 0 }, { x: w, y: h, z: d }, { x: w, y: 0, z: d }], normal: { x: -1, y: 0, z: 0 }, color: c.wallB }
    ];
  }

  function box(cx, cy, cz, hx, hy, hz, color, opts) {
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    const base = Object.assign({ color }, opts || {});
    return [
      Object.assign({ verts: [{ x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 }], normal: { x: 1, y: 0, z: 0 } }, base),
      Object.assign({ verts: [{ x: x0, y: y0, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y0, z: z0 }], normal: { x: -1, y: 0, z: 0 } }, base),
      Object.assign({ verts: [{ x: x0, y: y1, z: z0 }, { x: x0, y: y1, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z0 }], normal: { x: 0, y: 1, z: 0 } }, base),
      Object.assign({ verts: [{ x: x0, y: y0, z: z1 }, { x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }], normal: { x: 0, y: -1, z: 0 } }, base),
      Object.assign({ verts: [{ x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y0, z: z1 }], normal: { x: 0, y: 0, z: 1 } }, base),
      Object.assign({ verts: [{ x: x0, y: y0, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y0, z: z0 }], normal: { x: 0, y: 0, z: -1 } }, base)
    ];
  }

  // A flat vertical ring (annulus) of `seg` quads in the XY plane at fixed z — used for portals.
  function ring(cx, cy, cz, rOuter, rInner, seg, color, opts) {
    const faces = [];
    const base = Object.assign({ color, doubleSided: true, emissive: true }, opts || {});
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const o0 = { x: cx + Math.cos(a0) * rOuter, y: cy + Math.sin(a0) * rOuter, z: cz };
      const o1 = { x: cx + Math.cos(a1) * rOuter, y: cy + Math.sin(a1) * rOuter, z: cz };
      const i0 = { x: cx + Math.cos(a0) * rInner, y: cy + Math.sin(a0) * rInner, z: cz };
      const i1 = { x: cx + Math.cos(a1) * rInner, y: cy + Math.sin(a1) * rInner, z: cz };
      faces.push(Object.assign({ verts: [o0, o1, i1, i0], normal: { x: 0, y: 0, z: 1 } }, base));
    }
    return faces;
  }

  // An 8-sided bipyramid (two pyramids base-to-base) — used for the XP crystal.
  function bipyramid(cx, cy, cz, radius, height, color, opts) {
    const seg = 6;
    const top = { x: cx, y: cy + height, z: cz };
    const bot = { x: cx, y: cy - height, z: cz };
    const ring = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      ring.push({ x: cx + Math.cos(a) * radius, y: cy, z: cz + Math.sin(a) * radius });
    }
    const base = Object.assign({ color }, opts || {});
    const faces = [];
    for (let i = 0; i < seg; i++) {
      const a = ring[i], b = ring[(i + 1) % seg];
      const nTop = faceNormal(top, a, b);
      faces.push(Object.assign({ verts: [top, a, b], normal: nTop }, base));
      const nBot = faceNormal(bot, b, a);
      faces.push(Object.assign({ verts: [bot, b, a], normal: nBot }, base));
    }
    return faces;
  }

  function faceNormal(a, b, c) {
    const u = Vec.sub(b, a), v = Vec.sub(c, a);
    return Vec.norm({ x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x });
  }

  // ---------------- shading ----------------
  const LIGHT = Vec.norm({ x: 0.35, y: 0.9, z: 0.32 });
  function shade(hex, lit) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.round(r * lit)},${Math.round(g * lit)},${Math.round(b * lit)})`;
  }

  // ===================================================================
  // Scene runner
  // ===================================================================
  const EYE_H = 1.65, PLAYER_R = 0.35, WALK_SPEED = 3.0, MARGIN = 0.55;

  function openScene(cfg) {
    const W = window.innerWidth, H = window.innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);

    const root = document.createElement("div");
    root.className = "e3d-overlay";
    root.innerHTML = `
      <canvas class="e3d-canvas"></canvas>
      <div class="e3d-topbar">
        <div class="e3d-title">${cfg.title}</div>
        <button class="e3d-close" aria-label="Close">✕</button>
      </div>
      <div class="e3d-hint">${cfg.hint || "WASD to move · drag to look · click to interact"}</div>
      <div class="e3d-crosshair"></div>
      <div class="e3d-panel e3d-hidden">
        <button class="e3d-panel-close">✕</button>
        <div class="e3d-panel-body"></div>
      </div>
      <div class="e3d-toast e3d-hidden"></div>
    `;
    document.body.appendChild(root);

    const canvas = root.querySelector(".e3d-canvas");
    const ctx = canvas.getContext("2d");
    const panelEl = root.querySelector(".e3d-panel");
    const panelBody = root.querySelector(".e3d-panel-body");
    const toastEl = root.querySelector(".e3d-toast");
    const hintEl = root.querySelector(".e3d-hint");

    function resize() {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const room = cfg.roomSize || { w: 10, d: 12, h: 5 };
    const cam = { x: (cfg.spawn && cfg.spawn.x) || room.w / 2, y: EYE_H, z: (cfg.spawn && cfg.spawn.z) || 1.2, yaw: (cfg.spawn && cfg.spawn.yaw) || 0, pitch: 0 };

    const staticData = cfg.buildStatic ? cfg.buildStatic() : { faces: [], solids: [], interactives: [] };
    const staticFaces = staticData.faces || [];
    const solids = staticData.solids || []; // [{x,z,r}]
    const interactives = staticData.interactives || []; // [{id,pos,data}]

    let walkTarget = null; // {x,z,onArrive}
    const keys = new Set();
    let closed = false;
    let fScale = fovScale(cfg.fov || 72, window.innerHeight);

    // ---- input: keyboard (captured early so the underlying game never sees it) ----
    function keydown(e) {
      if (closed) return;
      keys.add(e.code);
      if (e.code === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
      e.preventDefault(); e.stopPropagation();
    }
    function keyup(e) {
      if (closed) return;
      keys.delete(e.code);
      e.preventDefault(); e.stopPropagation();
    }
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("keyup", keyup, true);

    // ---- input: drag-to-look + click/tap-to-interact (mouse + touch) ----
    let dragging = false, lastX = 0, lastY = 0, moved = 0, downAt = 0;
    const SENS = 0.0035;

    function pointerDown(x, y) { dragging = true; lastX = x; lastY = y; moved = 0; downAt = performance.now(); }
    function pointerMove(x, y) {
      if (!dragging) return;
      const dx = x - lastX, dy = y - lastY;
      lastX = x; lastY = y; moved += Math.abs(dx) + Math.abs(dy);
      cam.yaw += dx * SENS;
      cam.pitch = Math.max(-1.3, Math.min(1.3, cam.pitch - dy * SENS));
    }
    function pointerUp(x, y) {
      dragging = false;
      if (moved < 14) handleClick(x, y);
    }

    canvas.addEventListener("mousedown", (e) => { pointerDown(e.clientX, e.clientY); e.preventDefault(); });
    window.addEventListener("mousemove", (e) => pointerMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", (e) => { if (dragging) pointerUp(e.clientX, e.clientY); });

    canvas.addEventListener("touchstart", (e) => { const t = e.touches[0]; pointerDown(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener("touchmove", (e) => { const t = e.touches[0]; pointerMove(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener("touchend", (e) => { const t = e.changedTouches[0]; pointerUp(t.clientX, t.clientY); });

    function handleClick(sx, sy) {
      // 1) interactive objects, nearest first
      const hits = [];
      interactives.forEach((it) => {
        const cs = toCameraSpace(cam, it.pos);
        const p = projectCam(cs, fScale, window.innerWidth, window.innerHeight);
        if (!p) return;
        const dx = p.x - sx, dy = p.y - sy;
        const r = it.hitRadiusPx || 52;
        if (dx * dx + dy * dy <= r * r) hits.push({ it, depth: p.depth });
      });
      if (hits.length) {
        hits.sort((a, b) => a.depth - b.depth);
        cfg.onInteract && cfg.onInteract(hits[0].it, api);
        return;
      }
      // 2) floor click -> walk there
      const dir = screenToRay(cam, fScale, sx, sy, window.innerWidth, window.innerHeight);
      if (dir.y >= -0.01) return;
      const t = (EYE_H - 0) / -dir.y;
      const hx = cam.x + dir.x * t, hz = cam.z + dir.z * t;
      walkTarget = { x: clamp(hx, MARGIN, room.w - MARGIN), z: clamp(hz, MARGIN, room.d - MARGIN), onArrive: null };
    }

    root.querySelector(".e3d-close").addEventListener("click", close);
    root.querySelector(".e3d-panel-close").addEventListener("click", () => api.hidePanel());

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function resolveCollision(x, z) {
      x = clamp(x, MARGIN, room.w - MARGIN);
      z = clamp(z, MARGIN, room.d - MARGIN);
      for (const s of solids) {
        const dx = x - s.x, dz = z - s.z;
        const minDist = PLAYER_R + s.r;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < minDist && d > 0.0001) {
          const push = (minDist - d);
          x += (dx / d) * push;
          z += (dz / d) * push;
        }
      }
      return { x, z };
    }

    function updateMovement(dt) {
      const fwd = { x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) };
      const right = { x: Math.cos(cam.yaw), z: -Math.sin(cam.yaw) };
      let mx = 0, mz = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) { mx += fwd.x; mz += fwd.z; }
      if (keys.has("KeyS") || keys.has("ArrowDown")) { mx -= fwd.x; mz -= fwd.z; }
      if (keys.has("KeyD") || keys.has("ArrowRight")) { mx += right.x; mz += right.z; }
      if (keys.has("KeyA") || keys.has("ArrowLeft")) { mx -= right.x; mz -= right.z; }

      if (mx !== 0 || mz !== 0) {
        const len = Math.sqrt(mx * mx + mz * mz);
        mx /= len; mz /= len;
        walkTarget = null;
        const next = resolveCollision(cam.x + mx * WALK_SPEED * dt, cam.z + mz * WALK_SPEED * dt);
        cam.x = next.x; cam.z = next.z;
      } else if (walkTarget) {
        const dx = walkTarget.x - cam.x, dz = walkTarget.z - cam.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.18) {
          cam.x = walkTarget.x; cam.z = walkTarget.z;
          const cb = walkTarget.onArrive; walkTarget = null;
          if (cb) cb();
        } else {
          const step = Math.min(dist, WALK_SPEED * dt);
          const next = resolveCollision(cam.x + (dx / dist) * step, cam.z + (dz / dist) * step);
          cam.x = next.x; cam.z = next.z;
        }
      }
    }

    // ---- render ----
    function projectFace(f) {
      const pts = [];
      let sumDepth = 0;
      for (const v of f.verts) {
        const cs = toCameraSpace(cam, v);
        const p = projectCam(cs, fScale, window.innerWidth, window.innerHeight);
        if (!p) return null;
        pts.push(p);
        sumDepth += p.depth;
      }
      const centroid = f.verts.reduce((a, v) => Vec.add(a, v), { x: 0, y: 0, z: 0 });
      const c = Vec.scale(centroid, 1 / f.verts.length);
      if (!f.doubleSided) {
        const toFace = Vec.sub(c, cam);
        if (Vec.dot(f.normal, toFace) > 0.02) return null;
      }
      return { pts, depth: sumDepth / f.verts.length, f };
    }

    function drawFace(item) {
      const { pts, f } = item;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      if (f.emissive) {
        ctx.globalAlpha = f.alpha != null ? f.alpha : 1;
        ctx.fillStyle = f.color;
        if (f.glow) { ctx.shadowColor = f.glow; ctx.shadowBlur = 22; }
      } else {
        const lit = Math.max(0.32, Vec.dot(f.normal, LIGHT));
        ctx.fillStyle = shade(f.color, lit);
      }
      ctx.fill();
      ctx.restore();
    }

    function projectSprite(s) {
      const cs = toCameraSpace(cam, s.pos);
      const p = projectCam(cs, fScale, window.innerWidth, window.innerHeight);
      if (!p) return null;
      return { sx: p.x, sy: p.y, scale: fScale / p.depth / 100, depth: p.depth, s };
    }

    let last = performance.now();
    function loop(now) {
      if (closed) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      updateMovement(dt);
      cfg.onUpdate && cfg.onUpdate(dt, api, { x: cam.x, z: cam.z });

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // sky/void backdrop
      ctx.fillStyle = cfg.voidColor || "#05050a";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      const dynamic = cfg.buildDynamic ? cfg.buildDynamic(now / 1000, { x: cam.x, z: cam.z }) : { faces: [], sprites: [] };
      const allFaces = staticFaces.concat(dynamic.faces || []);
      const drawables = [];
      allFaces.forEach((f) => { const it = projectFace(f); if (it) drawables.push({ type: "face", depth: it.depth, item: it }); });
      (dynamic.sprites || []).forEach((s) => { const it = projectSprite(s); if (it) drawables.push({ type: "sprite", depth: it.depth, item: it }); });

      drawables.sort((a, b) => b.depth - a.depth);
      drawables.forEach((d) => {
        if (d.type === "face") drawFace(d.item);
        else d.item.s.draw(ctx, d.item.sx, d.item.sy, d.item.scale, d.item.depth);
      });

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    function close() {
      if (closed) return;
      closed = true;
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("keyup", keyup, true);
      root.remove();
      cfg.onClose && cfg.onClose();
    }

    const api = {
      close,
      showPanel(html) { panelBody.innerHTML = html; panelEl.classList.remove("e3d-hidden"); },
      hidePanel() { panelEl.classList.add("e3d-hidden"); },
      toast(text, ms) {
        toastEl.textContent = text;
        toastEl.classList.remove("e3d-hidden");
        requestAnimationFrame(() => toastEl.classList.add("e3d-toast-in"));
        clearTimeout(toastEl._t);
        toastEl._t = setTimeout(() => { toastEl.classList.remove("e3d-toast-in"); setTimeout(() => toastEl.classList.add("e3d-hidden"), 250); }, ms || 2200);
      },
      walkTo(x, z, onArrive) { walkTarget = { x: clamp(x, MARGIN, room.w - MARGIN), z: clamp(z, MARGIN, room.d - MARGIN), onArrive: onArrive || null }; },
      getPlayerPos() { return { x: cam.x, z: cam.z }; },
      distanceTo(p) { const dx = cam.x - p.x, dz = cam.z - p.z; return Math.sqrt(dx * dx + dz * dz); },
      addInteractive(it) { interactives.push(it); },
      removeInteractive(id) { const idx = interactives.findIndex(i => i.id === id); if (idx !== -1) interactives.splice(idx, 1); },
      addSolid(s) { solids.push(s); },
      removeSolidNear(x, z) { const idx = solids.findIndex(s => Math.abs(s.x - x) < 0.01 && Math.abs(s.z - z) < 0.01); if (idx !== -1) solids.splice(idx, 1); },
      setHint(text) { hintEl.textContent = text; }
    };
    return api;
  }

  return { Vec, room, box, ring, bipyramid, faceNormal, openScene };
})();
