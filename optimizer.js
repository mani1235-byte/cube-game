// optimizer.js — CUBE GAME Phase 6: FPS Optimization
// Dynamic resolution, particle limits on mobile, lazy loading, frame budgeting
// ============================================================================
(function () {
  "use strict";

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth <= 768;

  // ── FPS Monitor ──────────────────────────────────────────────────────────
  let fps = 60, frameCount = 0, lastFpsTime = performance.now();
  const FPS_SAMPLE = 30; // measure every 30 frames

  function measureFPS() {
    frameCount++;
    if (frameCount >= FPS_SAMPLE) {
      const now = performance.now();
      fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      frameCount = 0;
      lastFpsTime = now;
      applyQuality();
    }
    requestAnimationFrame(measureFPS);
  }
  requestAnimationFrame(measureFPS);

  // ── Dynamic Resolution ───────────────────────────────────────────────────
  let currentQuality = isMobile ? "medium" : "high";
  let lastQualityChange = 0;
  const QUALITY_COOLDOWN = 3000; // ms between changes

  const qualityMap = {
    high:   { dprScale: 1.0,  particleLimit: 300, shadowRes: 1.0,  gridStep: 3  },
    medium: { dprScale: 0.85, particleLimit: 150, shadowRes: 0.75, gridStep: 6  },
    low:    { dprScale: 0.65, particleLimit: 60,  shadowRes: 0.5,  gridStep: 12 },
  };

  function applyQuality() {
    const now = performance.now();
    if (now - lastQualityChange < QUALITY_COOLDOWN) return;

    let newQ = currentQuality;
    if (fps < 30)      newQ = "low";
    else if (fps < 50) newQ = "medium";
    else if (fps > 58) newQ = isMobile ? "medium" : "high";

    if (newQ === currentQuality) return;
    currentQuality = newQ;
    lastQualityChange = now;

    const q = qualityMap[currentQuality];

    // Dynamic canvas resolution
    const canvas = document.getElementById("c");
    if (canvas) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * q.dprScale;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width  = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width  = w + "px";
      canvas.style.height = h + "px";
    }

    // Limit particles
    if (window.CubeParticles) {
      window.CubeParticles.setLimit(q.particleLimit);
    }

    // Update grid step in particles overlay
    if (window.CubeParticles) {
      window.CubeParticles.setGridStep(q.gridStep);
    }

    console.log(`⚡ Quality → ${currentQuality} (${fps} fps)`);
  }

  // ── Mobile particle hard limit ────────────────────────────────────────────
  if (isMobile && window.CubeParticles) {
    window.CubeParticles.setLimit(80);
  }

  // ── Lazy loading for non-critical pages ──────────────────────────────────
  // Prefetch next likely page after 2s idle
  let prefetched = false;
  function prefetchNext() {
    if (prefetched) return;
    prefetched = true;
    const links = ["./login.html", "./lang.html", "./index.html"];
    links.forEach(href => {
      const link = document.createElement("link");
      link.rel = "prefetch"; link.href = href;
      document.head.appendChild(link);
    });
  }
  setTimeout(prefetchNext, 2000);

  // ── Reduce shadow resolution on mobile ───────────────────────────────────
  // Inject CSS to skip expensive box-shadows on low-end
  if (isMobile || fps < 40) {
    const s = document.createElement("style");
    s.textContent = `
      @media (max-width: 768px) {
        .cube-3d .face { box-shadow: none !important; }
        #glow-overlay  { display: none; }
        #audio-bg      { opacity: 0.25 !important; }
      }
    `;
    document.head.appendChild(s);
  }

  // ── Frame budget guard — skip heavy draws when behind ────────────────────
  window.OPTIMIZER = {
    get fps() { return fps; },
    get quality() { return currentQuality; },
    get isMobile() { return isMobile; },
    shouldSkipHeavy() { return fps < 35; },
    particleLimit() { return qualityMap[currentQuality].particleLimit; },
  };

  // ── FPS counter (dev mode — press F2 to toggle) ──────────────────────────
  const fpsEl = document.createElement("div");
  fpsEl.id = "fps-counter";
  fpsEl.style.cssText = `
    position:fixed; top:8px; right:8px; font:12px monospace;
    color:rgba(103,215,240,0.7); z-index:9999; pointer-events:none;
    display:none;
  `;
  document.body.appendChild(fpsEl);

  let fpsVisible = false;
  document.addEventListener("keydown", e => {
    if (e.code === "F2") {
      fpsVisible = !fpsVisible;
      fpsEl.style.display = fpsVisible ? "block" : "none";
    }
  });

  setInterval(() => {
    if (fpsVisible) fpsEl.textContent = `${fps} FPS | ${currentQuality.toUpperCase()}`;
  }, 500);

  console.log(`⚡ Optimizer Phase 6 loaded! Mobile: ${isMobile}`);
})();
