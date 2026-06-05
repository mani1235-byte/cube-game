// intro.js — CUBE GAME Cinematic Intro
// Full 60-second experience — no skip allowed
// Connected: intro.html → login.html
// ============================================================================

(function () {
  "use strict";

  // ── Canvas setup ─────────────────────────────────────────────────────────
  const canvas = document.getElementById("introCanvas");
  const ctx    = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ── Scene timing (seconds) ────────────────────────────────────────────────
  // Total = 60 s  |  6 scenes
  const SCENE_TIMES = [
    { id: "scene1", start: 0,  end: 10 },  // void — cube appears
    { id: "scene2", start: 10, end: 20 },  // multiplication
    { id: "scene3", start: 20, end: 30 },  // chaos / fire
    { id: "scene4", start: 30, end: 40 },  // hero rises
    { id: "scene5", start: 40, end: 50 },  // evolution
    { id: "scene6", start: 50, end: 60 },  // call to action
  ];
  const TOTAL_DURATION = 60; // seconds

  // ── State ─────────────────────────────────────────────────────────────────
  let startTime       = null;
  let currentSceneIdx = -1;
  let ended           = false;

  // ── Progress bar & dots init ──────────────────────────────────────────────
  const progressFill = document.getElementById("progressFill");
  const dotsContainer = document.getElementById("sceneDots");

  SCENE_TIMES.forEach((_, i) => {
    const dot = document.createElement("div");
    dot.className = "dot";
    dot.id = `dot${i}`;
    dotsContainer.appendChild(dot);
  });

  function updateDots(idx) {
    document.querySelectorAll(".dot").forEach((d, i) => {
      d.classList.toggle("active", i === idx);
    });
  }

  // ── Scene switcher ────────────────────────────────────────────────────────
  function activateScene(idx) {
    if (idx === currentSceneIdx) return;
    currentSceneIdx = idx;

    SCENE_TIMES.forEach((s, i) => {
      const el = document.getElementById(s.id);
      el.classList.toggle("active", i === idx);
    });
    updateDots(idx);

    // Flash effect between scenes
    if (idx > 0) {
      const flash = document.createElement("div");
      flash.className = "flash";
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 500);
    }

    // Trigger text lines for the active scene
    const sceneEl = document.getElementById(SCENE_TIMES[idx].id);
    const lines   = sceneEl.querySelectorAll(".line");
    lines.forEach(line => {
      line.classList.remove("visible");
      const delay = parseInt(line.dataset.delay || 0, 10);
      setTimeout(() => line.classList.add("visible"), delay);
    });

    // Scene-specific init
    if (idx === 1) initBurstCubes();
    if (idx === 2) initFireCubes();
    if (idx === 4) initEvoCubes();
  }

  // ── Main loop ─────────────────────────────────────────────────────────────
  function mainLoop(ts) {
    if (!startTime) startTime = ts;
    const elapsed = (ts - startTime) / 1000; // seconds

    // Progress bar
    const pct = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
    progressFill.style.width = pct + "%";

    // Scene switching
    for (let i = 0; i < SCENE_TIMES.length; i++) {
      const s = SCENE_TIMES[i];
      if (elapsed >= s.start && elapsed < s.end) {
        activateScene(i);
        break;
      }
    }

    // Canvas particles per scene
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawParticles(elapsed);

    // End → redirect
    if (elapsed >= TOTAL_DURATION && !ended) {
      ended = true;
      endIntro();
      return; // stop the loop
    }

    if (ended) return; // music or skip already triggered end — stop the loop

    requestAnimationFrame(mainLoop);
  }

  requestAnimationFrame(mainLoop);

  // ── End → redirect to login ───────────────────────────────────────────────
  function endIntro() {
    try { introMusic.pause(); introMusic.currentTime = 0; } catch(e) {}
    document.body.style.transition = "opacity 0.8s ease";
    document.body.style.opacity = "0";
    setTimeout(() => { window.location.href = "./login.html"; }, 900);
    setTimeout(() => { window.location.replace("./login.html"); }, 2500);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CANVAS PARTICLE SYSTEMS
  // ════════════════════════════════════════════════════════════════════════

  // ── Floating star field (all scenes) ─────────────────────────────────────
  const stars = Array.from({ length: 120 }, () => ({
    x:    Math.random() * 2000,
    y:    Math.random() * 1200,
    r:    Math.random() * 1.4 + 0.3,
    spd:  Math.random() * 0.12 + 0.02,
    a:    Math.random(),
  }));

  function drawStars(t) {
    ctx.save();
    stars.forEach(s => {
      s.x -= s.spd;
      if (s.x < 0) { s.x = canvas.width + 5; s.y = Math.random() * canvas.height; }
      const alpha = 0.15 + Math.abs(Math.sin(t * 0.5 + s.a)) * 0.25;
      ctx.beginPath();
      ctx.arc(s.x % canvas.width, s.y % canvas.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
    ctx.restore();
  }

  // ── Scene-specific particles ──────────────────────────────────────────────
  // Scene 1: subtle radial pulse
  function drawScene1Particles(t) {
    const cx = canvas.width / 2, cy = canvas.height / 2;
    for (let i = 0; i < 3; i++) {
      const r   = ((t * 60 + i * 80) % 300) + 20;
      const alpha = Math.max(0, 0.15 - r / 2000);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(103,215,240,${alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Scene 2: flying cubes on canvas (complements CSS burst cubes)
  const canvasCubes = Array.from({ length: 30 }, () => newCanvasCube());
  function newCanvasCube() {
    const colors = ["#67d7f0", "#a6e02c", "#fa2473", "#fe9522", "#cc00ff"];
    return {
      x:    Math.random() * 2000,
      y:    Math.random() * 1200,
      size: 4 + Math.random() * 12,
      vx:   (Math.random() - 0.5) * 2.5,
      vy:   (Math.random() - 0.5) * 2.5,
      rot:  Math.random() * Math.PI * 2,
      vr:   (Math.random() - 0.5) * 0.08,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.3 + Math.random() * 0.5,
    };
  }
  function drawScene2Particles() {
    ctx.save();
    canvasCubes.forEach(c => {
      c.x += c.vx; c.y += c.vy; c.rot += c.vr;
      if (c.x < -50 || c.x > canvas.width + 50 ||
          c.y < -50 || c.y > canvas.height + 50) {
        Object.assign(c, newCanvasCube(),
          { x: Math.random() * canvas.width, y: Math.random() * canvas.height });
      }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.strokeStyle = c.color + Math.round(c.alpha * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 1;
      ctx.strokeRect(-c.size / 2, -c.size / 2, c.size, c.size);
      ctx.restore();
    });
    ctx.restore();
  }

  // Scene 3: fire embers
  const embers = Array.from({ length: 60 }, () => newEmber());
  function newEmber() {
    return {
      x:    Math.random() * 2000,
      y:    canvas.height + 10,
      vx:   (Math.random() - 0.5) * 1.5,
      vy:   -(1.5 + Math.random() * 3),
      life: 1.0,
      size: 1 + Math.random() * 3,
      hue:  20 + Math.random() * 40,
    };
  }
  function drawScene3Particles() {
    ctx.save();
    embers.forEach(e => {
      e.x += e.vx; e.y += e.vy;
      e.vy *= 0.98;
      e.life -= 0.008;
      if (e.life <= 0 || e.y < -20) Object.assign(e, newEmber(), { x: Math.random() * canvas.width });
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * e.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${e.hue}, 100%, 60%, ${e.life * 0.8})`;
      ctx.fill();
    });
    ctx.restore();
  }

  // Scene 4: electric arcs on canvas
  function drawScene4Particles(t) {
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const phase = t * 4 + i * 1.3;
      const x1 = canvas.width  * (0.2 + 0.6 * ((i * 0.37 + Math.sin(phase)) % 1));
      const y1 = canvas.height * (0.2 + 0.6 * ((i * 0.53 + Math.cos(phase * 0.7)) % 1));
      const x2 = canvas.width  * (0.2 + 0.6 * ((i * 0.61 + Math.sin(phase * 1.3 + 1)) % 1));
      const y2 = canvas.height * (0.2 + 0.6 * ((i * 0.47 + Math.cos(phase * 0.9)) % 1));
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      // Zigzag arc
      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const mx = x1 + (x2 - x1) * frac + (Math.random() - 0.5) * 40;
        const my = y1 + (y2 - y1) * frac + (Math.random() - 0.5) * 40;
        ctx.lineTo(mx, my);
      }
      ctx.strokeStyle = `rgba(103,215,240,${0.08 + Math.sin(phase) * 0.06})`;
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Scene 5: rainbow orbiting dots
  function drawScene5Particles(t) {
    ctx.save();
    const cx = canvas.width / 2, cy = canvas.height / 2;
    for (let i = 0; i < 48; i++) {
      const angle  = (i / 48) * Math.PI * 2 + t * 0.4;
      const radius = 180 + Math.sin(t + i * 0.3) * 40;
      const x      = cx + Math.cos(angle) * radius;
      const y      = cy + Math.sin(angle) * radius * 0.5;
      const hue    = (i / 48 * 360 + t * 60) % 360;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 65%, 0.7)`;
      ctx.fill();
    }
    ctx.restore();
  }

  // Scene 6: convergence vortex
  const vortexParticles = Array.from({ length: 80 }, (_, i) => ({
    angle:  (i / 80) * Math.PI * 2,
    radius: 100 + Math.random() * 300,
    speed:  0.008 + Math.random() * 0.012,
    size:   1 + Math.random() * 2.5,
    hue:    (i / 80) * 360,
  }));
  function drawScene6Particles(t) {
    ctx.save();
    const cx = canvas.width / 2, cy = canvas.height * 0.45;
    vortexParticles.forEach(p => {
      p.angle  += p.speed;
      p.radius  = Math.max(10, p.radius - 0.4);
      if (p.radius <= 10) p.radius = 300 + Math.random() * 200;
      const x   = cx + Math.cos(p.angle) * p.radius;
      const y   = cy + Math.sin(p.angle) * p.radius * 0.55;
      const hue = (p.hue + t * 30) % 360;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 65%, 0.6)`;
      ctx.fill();
    });
    ctx.restore();
  }

  // ── Master draw dispatcher ────────────────────────────────────────────────
  function drawParticles(t) {
    // Stars are always on
    drawStars(t);

    const idx = currentSceneIdx;
    if (idx === 0) drawScene1Particles(t);
    if (idx === 1) { drawScene2Particles(); }
    if (idx === 2) drawScene3Particles();
    if (idx === 3) drawScene4Particles(t);
    if (idx === 4) drawScene5Particles(t);
    if (idx === 5) drawScene6Particles(t);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CSS DOM PARTICLE SYSTEMS
  // ════════════════════════════════════════════════════════════════════════

  // ── Scene 2: burst cubes ──────────────────────────────────────────────────
  function initBurstCubes() {
    const container = document.getElementById("cubesBurst");
    if (!container || container.children.length > 0) return;
    const colors = ["#67d7f0", "#a6e02c", "#fa2473", "#fe9522", "#cc00ff", "#ff2200"];
    for (let i = 0; i < 28; i++) {
      const cube = document.createElement("div");
      cube.className = "burst-cube";
      const size   = 8 + Math.random() * 28;
      const startX = 20 + Math.random() * 60;
      const startY = 20 + Math.random() * 60;
      const endX   = (Math.random() - 0.5) * 120;
      const endY   = (Math.random() - 0.5) * 120;
      const dur    = 2 + Math.random() * 4;
      const delay  = Math.random() * 3;
      const color  = colors[Math.floor(Math.random() * colors.length)];
      cube.style.cssText = `
        width:${size}px; height:${size}px;
        left:${startX}%; top:${startY}%;
        border-color:${color};
        animation: burstFloat ${dur}s ${delay}s linear infinite;
        --tx:${endX}vw; --ty:${endY}vh;
      `;
      // Override keyframes per-cube via custom transform
      cube.style.setProperty("--tx", endX + "vw");
      cube.style.setProperty("--ty", endY + "vh");
      container.appendChild(cube);
    }
    // Inject per-cube keyframe support (translate from center outward)
    injectBurstStyles();
  }

  function injectBurstStyles() {
    if (document.getElementById("burstStylesheet")) return;
    const style = document.createElement("style");
    style.id = "burstStylesheet";
    style.textContent = `
      @keyframes burstFloat {
        0%   { transform: translate(0,0) rotate(0deg) scale(0); opacity:0; }
        10%  { opacity: 0.7; transform: translate(0,0) rotate(20deg) scale(1); }
        90%  { opacity: 0.3; }
        100% { transform: translate(var(--tx, 10vw), var(--ty, -10vh)) rotate(360deg) scale(0.5); opacity:0; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Scene 3: fire falling cubes ───────────────────────────────────────────
  function initFireCubes() {
    const container = document.getElementById("fireCubes");
    if (!container || container.children.length > 0) return;
    for (let i = 0; i < 22; i++) {
      const cube  = document.createElement("div");
      cube.className = "fire-cube";
      const size  = 6 + Math.random() * 22;
      const left  = Math.random() * 100;
      const dur   = 1.5 + Math.random() * 2.5;
      const delay = Math.random() * 4;
      cube.style.cssText = `
        width:${size}px; height:${size}px;
        left:${left}%;
        animation-duration:${dur}s;
        animation-delay:${delay}s;
        border-color: hsl(${20 + Math.random() * 30}, 100%, 60%);
      `;
      container.appendChild(cube);
    }
  }

  // ── Scene 5: evolution cubes ──────────────────────────────────────────────
  function initEvoCubes() {
    const container = document.getElementById("evoCubes");
    if (!container || container.children.length > 0) return;

    const stages = [
      { color: "#aaaaaa", label: "NORMAL" },
      { color: "#fe9522", label: "HEATED" },
      { color: "#67d7f0", label: "ELECTRIC" },
      { color: "#ff2200", label: "INFERNO" },
      { color: "#cc00ff", label: "VOID" },
      { color: "rainbow", label: "RAINBOW" },
    ];

    stages.forEach((stage, i) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        display: flex; flex-direction: column; align-items: center; gap: 10px;
      `;

      const cube = document.createElement("div");
      cube.className = "evo-cube";

      if (stage.color === "rainbow") {
        cube.style.cssText = `
          width:40px; height:40px;
          border: 1.5px solid;
          animation: evoSpin 3s linear infinite, evoPop 0.5s ${i * 0.12}s cubic-bezier(0.16,1,0.3,1) both, rainbowBorder 2s linear infinite;
        `;
      } else {
        cube.style.cssText = `
          width:40px; height:40px;
          border: 1.5px solid ${stage.color};
          box-shadow: 0 0 12px ${stage.color}88;
          animation: evoSpin 3s linear infinite, evoPop 0.5s ${i * 0.12}s cubic-bezier(0.16,1,0.3,1) both;
        `;
      }

      const label = document.createElement("div");
      label.textContent = stage.label;
      label.style.cssText = `
        font-family: 'Share Tech Mono', monospace;
        font-size: 0.55rem;
        letter-spacing: 0.1em;
        color: ${stage.color === "rainbow" ? "var(--cyan)" : stage.color};
        opacity: 0;
        animation: evoPop 0.5s ${i * 0.12 + 0.3}s ease both;
      `;

      wrapper.appendChild(cube);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // ── Intro music ───────────────────────────────────────────────────────
  const introMusic = new Audio("./intro music_original.mp3");
  introMusic.volume = 0.7;
  introMusic.loop   = true; // keep looping until the 60s timer ends

  // Try to auto-play immediately
  introMusic.play().catch(() => {
    // Browser blocked autoplay — start on first interaction instead
    document.addEventListener("pointerdown", () => {
      introMusic.play().catch(() => {});
    }, { once: true });
  });

  // ── Skip button & keyboard shortcut ──────────────────────────────────────
  function skipIntro() {
    if (ended) return;
    ended = true;
    endIntro();
  }

  document.getElementById("btn-skip")?.addEventListener("click", skipIntro);

  // ── Next button — jump to next scene ─────────────────────────────────────
  const btnNext = document.getElementById("btn-next");
  if (btnNext) {
    btnNext.addEventListener("click", () => {
      if (ended) return;
      const nextIdx = currentSceneIdx + 1;
      if (nextIdx >= SCENE_TIMES.length) {
        // Last scene → end intro
        skipIntro();
        return;
      }
      // Jump time forward to next scene start
      const targetTime = SCENE_TIMES[nextIdx].start;
      // Offset startTime so elapsed jumps to targetTime
      startTime = performance.now() - targetTime * 1000;

      // Visual flash
      const flash = document.createElement("div");
      flash.className = "flash";
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 400);

      activateScene(nextIdx);
    });
  }

  document.addEventListener("keydown", e => {
    if (e.code === "Escape") skipIntro();
    if (e.code === "ArrowRight" || e.code === "Space") {
      document.getElementById("btn-next")?.click();
    }
  });

  // ── Auto-start first scene lines ──────────────────────────────────────────
  setTimeout(() => {
    const lines = document.querySelectorAll("#scene1 .line");
    lines.forEach(line => {
      const delay = parseInt(line.dataset.delay || 0, 10);
      setTimeout(() => line.classList.add("visible"), delay);
    });
  }, 50);

  console.log("🎬 CUBE GAME Intro loaded — 60s cinematic experience begins…");

})();