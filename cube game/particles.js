// particles.js — CUBE GAME Advanced Particle System + Dynamic Lighting
// Phase 2 & 3: Floating particles, Neon dots, Ambient dust, Destroy FX,
//              Bloom, Glow, Emissive materials, Soft shadows, Dynamic lights
// ============================================================================
// Works on top of the existing Canvas 2D game with a dedicated overlay canvas.
// ============================================================================

(function () {
  "use strict";

  // ── Wait for game canvas to exist ─────────────────────────────────────────
  const gameCanvas = document.querySelector("#c");
  if (!gameCanvas) return;

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERLAY CANVAS — sits on top of game canvas, pointer-events: none
  // ═══════════════════════════════════════════════════════════════════════════
  const oc = document.createElement("canvas");
  oc.id = "particle-overlay";
  oc.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 5;
  `;
  document.body.appendChild(oc);
  const ctx = oc.getContext("2d");

  // Glow canvas — separate pass for bloom effect
  const gc = document.createElement("canvas");
  gc.id = "glow-overlay";
  gc.style.cssText = `
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 4;
    mix-blend-mode: screen;
    opacity: 0.85;
  `;
  document.body.appendChild(gc);
  const gctx = gc.getContext("2d");

  // ── Resize handler ────────────────────────────────────────────────────────
  let W = window.innerWidth;
  let H = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    oc.width  = W * dpr; oc.height = H * dpr;
    oc.style.width = W + "px"; oc.style.height = H + "px";
    gc.width  = W * dpr; gc.height = H * dpr;
    gc.style.width = W + "px"; gc.style.height = H + "px";
    ctx.scale(dpr, dpr);
    gctx.scale(dpr, dpr);
  }
  resize();
  window.addEventListener("resize", () => { resize(); });

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME COLOR PALETTE  (matches game colors exactly)
  // ═══════════════════════════════════════════════════════════════════════════
  const PALETTE = [
    { r: 103, g: 215, b: 240 }, // cyan  (BLUE)
    { r: 166, g: 224, b:  44 }, // green
    { r: 250, g:  36, b: 115 }, // pink
    { r: 254, g: 149, b:  34 }, // orange
    { r: 204, g:   0, b: 255 }, // purple (evo)
    { r: 255, g:  34, b:   0 }, // red    (evo)
  ];

  function randColor() {
    return PALETTE[Math.floor(Math.random() * PALETTE.length)];
  }

  function colorStr(c, a = 1) {
    return `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC LIGHT SYSTEM  💡
  // Each "light" is a point that emits a radial glow on the glow canvas.
  // ═══════════════════════════════════════════════════════════════════════════
  const lights = [];

  class DynamicLight {
    constructor(x, y, color, radius = 180, intensity = 1, life = 1) {
      this.x = x; this.y = y;      this.color = color;
      this.radius = radius;
      this.intensity = intensity;
      this.life = life;        // 0..1
      this.decay = life > 0.98 ? 0 : 0.018 + Math.random() * 0.012;
      this.permanent = life > 0.98;
    }

    update() {
      if (!this.permanent) this.life -= this.decay;
    }

    draw(ctx) {
      const alpha = Math.max(0, this.life) * this.intensity * 0.35;
      if (alpha < 0.005) return;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0,   colorStr(this.color, alpha));
      grad.addColorStop(0.4, colorStr(this.color, alpha * 0.4));
      grad.addColorStop(1,   colorStr(this.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    alive() { return this.permanent || this.life > 0; }
  }

  // Permanent ambient lights (slowly drift around)
  const ambientLights = [];
  function createAmbientLights() {
    const configs = [
      { x: W * 0.15, y: H * 0.3,  color: PALETTE[0], r: 320, i: 0.5 },
      { x: W * 0.85, y: H * 0.6,  color: PALETTE[3], r: 280, i: 0.45 },
      { x: W * 0.5,  y: H * 0.85, color: PALETTE[1], r: 260, i: 0.4 },
      { x: W * 0.2,  y: H * 0.8,  color: PALETTE[2], r: 240, i: 0.35 },
    ];
    configs.forEach(c => {
      const l = new DynamicLight(c.x, c.y, c.color, c.r, c.i, 1);
      l.permanent = true;
      l.vx = (Math.random() - 0.5) * 0.4;
      l.vy = (Math.random() - 0.5) * 0.3;
      l.ox = c.x; l.oy = c.y;
      l.drift = Math.random() * Math.PI * 2;
      ambientLights.push(l);
    });
  }
  createAmbientLights();

  function updateAmbientLights(t) {
    ambientLights.forEach(l => {
      l.drift += 0.004;
      l.x = l.ox + Math.sin(l.drift) * 80;
      l.y = l.oy + Math.cos(l.drift * 0.7) * 50;
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICLE CLASSES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Ambient Dust ───────────────────────────────────────────────────────
  class DustParticle {
    constructor() { this.reset(true); }

    reset(init = false) {
      this.x  = Math.random() * W;
      this.y  = init ? Math.random() * H : H + 8;
      this.vx = (Math.random() - 0.5) * 0.25;
      this.vy = -(0.15 + Math.random() * 0.35);
      this.r  = 0.5 + Math.random() * 1.5;
      this.color = randColor();
      this.alpha = 0.04 + Math.random() * 0.1;
      this.life = 1;
      this.maxLife = 180 + Math.random() * 300;
      this.age = init ? Math.random() * this.maxLife : 0;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.01 + Math.random() * 0.02;
    }

    update() {
      this.age++;
      this.wobble += this.wobbleSpeed;
      this.x += this.vx + Math.sin(this.wobble) * 0.2;
      this.y += this.vy;
      this.life = 1 - this.age / this.maxLife;
      if (this.age > this.maxLife || this.y < -10) this.reset();
    }

    draw(ctx) {
      const a = this.alpha * this.life;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = colorStr(this.color, a);
      ctx.fill();
    }
  }

  // ── 2. Floating Neon Dots ─────────────────────────────────────────────────
  class NeonDot {
    constructor() { this.reset(true); }

    reset(init = false) {
      this.x    = Math.random() * W;
      this.y    = init ? Math.random() * H : H + 20;
      this.vy   = -(0.3 + Math.random() * 0.6);
      this.vx   = (Math.random() - 0.5) * 0.4;
      this.r    = 1.5 + Math.random() * 3;
      this.color = randColor();
      this.glow  = 6 + Math.random() * 10;
      this.pulse = Math.random() * Math.PI * 2;
      this.pulseSpeed = 0.03 + Math.random() * 0.04;
      this.baseAlpha = 0.5 + Math.random() * 0.5;
      this.maxAge = 200 + Math.random() * 400;
      this.age = init ? Math.random() * this.maxAge : 0;
    }

    update() {
      this.age++;
      this.pulse += this.pulseSpeed;
      this.x += this.vx;
      this.y += this.vy;
      if (this.age > this.maxAge || this.y < -20) this.reset();
    }

    draw(ctx) {
      const life = 1 - this.age / this.maxAge;
      const pulse = 0.7 + Math.sin(this.pulse) * 0.3;
      const a = this.baseAlpha * life * pulse;
      const r = this.r * pulse;

      // Glow halo
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r + this.glow);
      grad.addColorStop(0, colorStr(this.color, a));
      grad.addColorStop(0.3, colorStr(this.color, a * 0.6));
      grad.addColorStop(1, colorStr(this.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + this.glow, 0, Math.PI * 2);
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = colorStr({ r: 255, g: 255, b: 255 }, a);
      ctx.fill();
    }
  }

  // ── 3. Destroy Burst Particles ────────────────────────────────────────────
  class BurstParticle {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.color = color;
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed - 2;
      this.gravity = 0.12;
      this.r = 2 + Math.random() * 4;
      this.life = 1;
      this.decay = 0.025 + Math.random() * 0.02;
      this.trail = [];
      this.spin = (Math.random() - 0.5) * 0.3;
      this.angle = 0;
      // Type: 0=circle, 1=square, 2=spark
      this.type = Math.floor(Math.random() * 3);
    }

    update() {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();
      this.x += this.vx;
      this.y += this.vy;
      this.vy += this.gravity;
      this.vx *= 0.98;
      this.angle += this.spin;
      this.life -= this.decay;
    }

    draw(ctx) {
      if (this.life <= 0) return;

      // Draw trail
      if (this.trail.length > 1) {
        ctx.save();
        for (let i = 1; i < this.trail.length; i++) {
          const t0 = this.trail[i - 1];
          const t1 = this.trail[i];
          const ta = (i / this.trail.length) * this.life * 0.4;
          ctx.strokeStyle = colorStr(this.color, ta);
          ctx.lineWidth = this.r * (i / this.trail.length);
          ctx.beginPath();
          ctx.moveTo(t0.x, t0.y);
          ctx.lineTo(t1.x, t1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = this.life;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);

      if (this.type === 0) {
        // Glowing circle
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.r * 2.5);
        grad.addColorStop(0, colorStr({ r: 255, g: 255, b: 255 }, 1));
        grad.addColorStop(0.3, colorStr(this.color, 1));
        grad.addColorStop(1, colorStr(this.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.type === 1) {
        // Spinning square
        ctx.fillStyle = colorStr(this.color, this.life);
        ctx.fillRect(-this.r, -this.r, this.r * 2, this.r * 2);
      } else {
        // Spark line
        ctx.strokeStyle = colorStr(this.color, this.life);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.vx * 3, -this.vy * 3);
        ctx.stroke();
      }

      ctx.restore();
    }

    alive() { return this.life > 0; }
  }

  // ── 4. Shockwave ring (on destroy) ───────────────────────────────────────
  class ShockWave {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.color = color;
      this.r = 10;
      this.maxR = 80 + Math.random() * 60;
      this.life = 1;
      this.decay = 0.04;
      this.lineWidth = 3;
    }

    update() {
      this.r += (this.maxR - this.r) * 0.18;
      this.life -= this.decay;
      this.lineWidth = 3 * this.life;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      ctx.save();
      ctx.globalAlpha = this.life * 0.7;
      ctx.strokeStyle = colorStr(this.color, 1);
      ctx.lineWidth = this.lineWidth;
      ctx.shadowBlur = 20;
      ctx.shadowColor = colorStr(this.color, 1);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    alive() { return this.life > 0; }
  }

  // ── 5. Slash trail particle (follows pointer) ─────────────────────────────
  class SlashTrail {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.life = 1;
      this.decay = 0.08;
      this.r = 4 + Math.random() * 3;
    }

    update() { this.life -= this.decay; }

    draw(ctx) {
      if (this.life <= 0) return;
      const a = this.life * 0.6;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 3);
      grad.addColorStop(0, `rgba(170,221,255,${a})`);
      grad.addColorStop(1, `rgba(103,215,240,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    alive() { return this.life > 0; }
  }

  // ── 6. Bloom flash (instant bright burst on hit) ─────────────────────────
  class BloomFlash {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.color = color;
      this.life = 1;
      this.r = 20;
      this.maxR = 120;
    }

    update() {
      this.life -= 0.1;
      this.r += (this.maxR - this.r) * 0.3;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
      grad.addColorStop(0, colorStr({ r: 255, g: 255, b: 255 }, this.life * 0.9));
      grad.addColorStop(0.2, colorStr(this.color, this.life * 0.6));
      grad.addColorStop(1, colorStr(this.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
    }

    alive() { return this.life > 0; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARTICLE POOLS & EMISSION
  // ═══════════════════════════════════════════════════════════════════════════
  const DUST_COUNT  = 60;
  const NEON_COUNT  = 28;
  const MAX_BURST   = 300;

  const dustParticles = Array.from({ length: DUST_COUNT }, () => new DustParticle());
  const neonDots      = Array.from({ length: NEON_COUNT }, () => new NeonDot());
  const burstPool     = [];    // BurstParticle
  const shockwaves    = [];
  const bloomFlashes  = [];
  const slashTrails   = [];

  // Called from game events (see hooks below)
  function emitDestroyFX(screenX, screenY, color) {
    // Burst particles
    const count = 18 + Math.floor(Math.random() * 14);
    for (let i = 0; i < count && burstPool.length < MAX_BURST; i++) {
      burstPool.push(new BurstParticle(screenX, screenY, color));
    }
    // Shockwaves (2 rings)
    shockwaves.push(new ShockWave(screenX, screenY, color));
    shockwaves.push(new ShockWave(screenX, screenY, { r: 255, g: 255, b: 255 }));

    // Bloom
    bloomFlashes.push(new BloomFlash(screenX, screenY, color));

    // Dynamic light burst
    lights.push(new DynamicLight(screenX, screenY, color, 200, 1.2, 1));

    // Extra mini dusts from explosion
    for (let i = 0; i < 6; i++) {
      const p = new DustParticle();
      p.x = screenX + (Math.random() - 0.5) * 40;
      p.y = screenY + (Math.random() - 0.5) * 40;
      p.vy = -(0.5 + Math.random() * 1.5);
      p.vx = (Math.random() - 0.5) * 1.5;
      p.color = color;
      p.alpha = 0.3 + Math.random() * 0.4;
      p.age = 0;
      p.maxLife = 60 + Math.random() * 80;
      dustParticles.push(p);
    }
  }

  function emitSlashTrail(x, y) {
    if (slashTrails.length < 80) {
      slashTrails.push(new SlashTrail(x, y));
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HOOK INTO GAME ENGINE
  // ═══════════════════════════════════════════════════════════════════════════

  // We patch the global `createBurst` and pointer events to inject our effects.
  // The game defines these globally so we can intercept safely.

  let _patchAttempts = 0;
  function patchGame() {
    _patchAttempts++;
    if (_patchAttempts > 60) return; // give up after ~1s

    // Patch createBurst
    if (typeof window.createBurst === "undefined") {
      // Not exposed globally — use sparkBurst hook instead
    }

    // Patch sparkBurst (called on every hit)
    if (typeof window.sparkBurst === "function" && !window._sparkBurst_patched) {
      const _orig = window.sparkBurst;
      window.sparkBurst = function (x, y, count, speed) {
        _orig(x, y, count, speed);
        // Convert scene coords → screen coords
        const sx = screenFromScene(x);
        const sy = screenFromScene(y);
        if (count >= 8) {
          // Full destroy
          const color = randColor();
          emitDestroyFX(sx.x, sx.y, color);
        } else {
          // Small hit
          bloomFlashes.push(new BloomFlash(sx.x, sx.y, PALETTE[0]));
          lights.push(new DynamicLight(sx.x, sx.y, PALETTE[0], 100, 0.8, 0.6));
        }
      };
      window._sparkBurst_patched = true;
      console.log("🎆 ParticleSystem: sparkBurst hooked");
    }

    // Patch pointer movement for slash trail
    if (!window._pointerPatch_done) {
      document.addEventListener("pointermove", (e) => {
        if (typeof window.pointerIsDown !== "undefined" && window.pointerIsDown) {
          emitSlashTrail(e.clientX, e.clientY);
          // Pointer light
          if (lights.length < 30) {
            lights.push(new DynamicLight(e.clientX, e.clientY, PALETTE[0], 80, 0.7, 0.3));
          }
        }
      });
      window._pointerPatch_done = true;
    }

    if (window._sparkBurst_patched) return; // done
    setTimeout(patchGame, 100);
  }

  // Scene→screen coordinate helper using game's exposed viewScale
  function screenFromScene(sceneX, sceneY) {
    const vScale = window._cgViewScale || (window.innerHeight / 1000);
    const halfW  = window._cgHalfW    || (window.innerWidth / 2);
    const halfH  = window._cgHalfH    || (window.innerHeight / 2);
    return {
      x: ((sceneX || 0) + halfW) * vScale,
      y: ((sceneY || 0) + halfH) * vScale,
    };
  }

  setTimeout(patchGame, 200);

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOOM POST-PROCESS (soft glow pass on glow canvas)
  // ═══════════════════════════════════════════════════════════════════════════
  function drawGlowPass(t) {
    gctx.clearRect(0, 0, W, H);

    // Ambient lights on glow canvas
    [...ambientLights, ...lights].forEach(l => {
      if (l.alive()) l.draw(gctx);
    });

    // Neon dot halos on glow canvas
    neonDots.forEach(n => {
      const life = 1 - n.age / n.maxAge;
      const pulse = 0.6 + Math.sin(n.pulse) * 0.4;
      const a = n.baseAlpha * life * pulse * 0.5;
      if (a < 0.01) return;
      const grad = gctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 4 + n.glow * 1.5);
      grad.addColorStop(0, colorStr(n.color, a));
      grad.addColorStop(1, colorStr(n.color, 0));
      gctx.fillStyle = grad;
      gctx.beginPath();
      gctx.arc(n.x, n.y, n.r * 4 + n.glow * 1.5, 0, Math.PI * 2);
      gctx.fill();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EMISSIVE BACKGROUND GRID (dynamic lighting on scene)
  // ═══════════════════════════════════════════════════════════════════════════
  const GRID_COLS = 12;
  const GRID_ROWS = 8;

  function drawEmissiveGrid(t) {
    const cw = W / GRID_COLS;
    const ch = H / GRID_ROWS;

    ctx.save();
    ctx.lineWidth = 0.5;

    for (let r = 0; r <= GRID_ROWS; r++) {
      for (let c = 0; c <= GRID_COLS; c++) {
        const x = c * cw;
        const y = r * ch;

        // Check proximity to each ambient light for emissive effect
        let glow = 0;
        let glowColor = PALETTE[0];
        [...ambientLights, ...lights].forEach(l => {
          if (!l.alive()) return;
          const d = Math.hypot(l.x - x, l.y - y);
          const strength = Math.max(0, 1 - d / l.radius) * (l.permanent ? l.intensity : l.life * l.intensity);
          if (strength > glow) { glow = strength; glowColor = l.color; }
        });

        if (glow > 0.02) {
          ctx.strokeStyle = colorStr(glowColor, glow * 0.25);
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + glow * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }

    // Draw faint grid lines lit by dynamic lights
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      for (let c = 0; c <= GRID_COLS; c++) {
        const x = c * cw;
        const y = r * ch;
        let glow = 0;
        let col = PALETTE[0];
        [...ambientLights].forEach(l => {
          const d = Math.hypot(l.x - x, l.y - y);
          const s = Math.max(0, 1 - d / l.radius) * l.intensity;
          if (s > glow) { glow = s; col = l.color; }
        });
        ctx.strokeStyle = colorStr(col, Math.max(0.01, glow * 0.07));
        ctx.moveTo(x, r * ch);
        ctx.lineTo(x + cw, r * ch);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOFT SHADOW EMITTERS (dynamic coloured shadows under particles)
  // ═══════════════════════════════════════════════════════════════════════════
  function drawSoftShadows() {
    ctx.save();
    neonDots.forEach(n => {
      const life = 1 - n.age / n.maxAge;
      if (life < 0.1) return;
      const sy = n.y + (H - n.y) * 0.08; // shadow toward bottom
      const sx = n.x;
      const a = life * 0.08;
      const grad = ctx.createEllipse
        ? null // not standard
        : ctx.createRadialGradient(sx, sy + 4, 0, sx, sy + 4, n.r * 3);
      if (!grad) return;
      grad.addColorStop(0, colorStr(n.color, a));
      grad.addColorStop(1, colorStr(n.color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 4, n.r * 3, n.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER LOOP
  // ═══════════════════════════════════════════════════════════════════════════
  let lastT = 0;

  function frame(ts) {
    requestAnimationFrame(frame);

    const t = ts / 1000;
    const dt = Math.min(t - lastT, 0.05);
    lastT = t;

    // Check if game is active (don't render particles on menus)
    const onMenu = document.querySelector(".menu.active") !== null;

    ctx.clearRect(0, 0, W, H);

    // ── Update ambient lights ──
    updateAmbientLights(t);

    // ── Glow pass ──
    drawGlowPass(t);

    if (onMenu) {
      // On menus: only ambient floating particles + lights, no grid
      dustParticles.forEach(p => { p.update(); p.draw(ctx); });
      neonDots.forEach(p => { p.update(); p.draw(ctx); });
      return;
    }

    // ── Emissive grid ──
    drawEmissiveGrid(t);

    // ── Soft shadows ──
    drawSoftShadows();

    // ── Ambient dust ──
    dustParticles.forEach(p => { p.update(); p.draw(ctx); });

    // ── Neon floating dots ──
    neonDots.forEach(p => { p.update(); p.draw(ctx); });

    // ── Slash trails ──
    for (let i = slashTrails.length - 1; i >= 0; i--) {
      slashTrails[i].update();
      slashTrails[i].draw(ctx);
      if (!slashTrails[i].alive()) slashTrails.splice(i, 1);
    }

    // ── Burst particles ──
    for (let i = burstPool.length - 1; i >= 0; i--) {
      burstPool[i].update();
      burstPool[i].draw(ctx);
      if (!burstPool[i].alive()) burstPool.splice(i, 1);
    }

    // ── Shockwaves ──
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      shockwaves[i].update();
      shockwaves[i].draw(ctx);
      if (!shockwaves[i].alive()) shockwaves.splice(i, 1);
    }

    // ── Bloom flashes ──
    for (let i = bloomFlashes.length - 1; i >= 0; i--) {
      bloomFlashes[i].update();
      bloomFlashes[i].draw(ctx);
      if (!bloomFlashes[i].alive()) bloomFlashes.splice(i, 1);
    }

    // ── Transient lights ──
    for (let i = lights.length - 1; i >= 0; i--) {
      lights[i].update();
      if (!lights[i].alive()) lights.splice(i, 1);
    }
  }

  requestAnimationFrame(frame);

  // ── Expose public API ─────────────────────────────────────────────────────
  window.CubeParticles = {
    emitDestroyFX,
    emitSlashTrail,
    addLight: (x, y, color, radius, intensity, life) =>
      lights.push(new DynamicLight(x, y, color, radius, intensity, life)),
  };

  console.log("✨ CubeParticles system loaded — Phase 2 & 3 active");

})();
