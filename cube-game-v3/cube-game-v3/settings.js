// mobile.js — CUBE GAME Mobile Optimization
// Works on both mobile.html (settings) AND index.html (game)
// ============================================================================

(function () {
  "use strict";

  const SETTINGS_KEY = "cg_mobile_settings";

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return s || { swipe: true, tap: true, trail: true, fullscreen: false, orientLock: false };
    } catch(e) {
      return { swipe: true, tap: true, trail: true, fullscreen: false, orientLock: false };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  let settings = loadSettings();

  // Detect touch capability (covers phone, tablet, touchscreen laptop/PC)
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;

  // ═══════════════════════════════════════════════════════════════════════
  //  SETTINGS PAGE (mobile.html)
  // ═══════════════════════════════════════════════════════════════════════

  function initSettingsPage() {
    const swipeToggle     = document.getElementById("swipeToggle");
    const tapToggle       = document.getElementById("tapToggle");
    const trailToggle     = document.getElementById("trailToggle");
    const fullToggle      = document.getElementById("fullscreenToggle");
    const orientToggle    = document.getElementById("orientToggle");
    const saveBtn         = document.getElementById("mobileSaveBtn");
    if (!saveBtn) return; // not on settings page

    // Set values
    swipeToggle.checked  = settings.swipe;
    tapToggle.checked    = settings.tap;
    trailToggle.checked  = settings.trail;
    fullToggle.checked   = settings.fullscreen;
    orientToggle.checked = settings.orientLock;

    swipeToggle.addEventListener("change",  () => { settings.swipe      = swipeToggle.checked; });
    tapToggle.addEventListener("change",    () => { settings.tap        = tapToggle.checked; });
    trailToggle.addEventListener("change",  () => { settings.trail      = trailToggle.checked; });
    fullToggle.addEventListener("change",   () => { settings.fullscreen = fullToggle.checked; });
    orientToggle.addEventListener("change", () => { settings.orientLock = orientToggle.checked; });

    saveBtn.addEventListener("click", () => {
      saveSettings(settings);
      const toast = document.getElementById("mobileToast");
      if (toast) {
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
      }
    });

    // Canvas particles
    const canvas = document.getElementById("mobileCanvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
      resize(); window.addEventListener("resize", resize);
      const particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.3, a: Math.random(),
      }));
      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(103,215,240,${0.04 + Math.abs(Math.sin(Date.now() * 0.001 + p.a)) * 0.07})`;
          ctx.fill();
        });
        requestAnimationFrame(draw);
      }
      draw();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GAME PAGE (index.html)
  // ═══════════════════════════════════════════════════════════════════════

  function initGamePage() {
    const canvas = document.getElementById("c");
    if (!canvas || !isTouch) return;

    // Fix viewport
    let vp = document.querySelector('meta[name="viewport"]');
    if (!vp) { vp = document.createElement("meta"); vp.name = "viewport"; document.head.appendChild(vp); }
    vp.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover";

    // Orientation warning
    const orientWarn = document.createElement("div");
    orientWarn.id = "orientWarning";
    orientWarn.innerHTML = `<div class="orient-icon">📱</div><p>Rotate for best experience!</p>`;
    document.body.appendChild(orientWarn);

    window.addEventListener("orientationchange", () => {
      setTimeout(() => {
        if (window.innerHeight > window.innerWidth) {
          orientWarn.classList.add("show");
          setTimeout(() => orientWarn.classList.remove("show"), 2500);
        } else {
          orientWarn.classList.remove("show");
        }
      }, 300);
    });

    // Touch trail
    function spawnTrail(x, y) {
      if (!settings.trail) return;
      const dot = document.createElement("div");
      dot.className = "touch-trail";
      dot.style.left = x + "px";
      dot.style.top  = y + "px";
      document.body.appendChild(dot);
      setTimeout(() => dot.remove(), 300);
    }

    // Pointer simulation
    function simulatePointer(type, x, y) {
      canvas.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true,
        clientX: x, clientY: y,
        pointerId: 1, pointerType: "touch", isPrimary: true,
      }));
    }

    let lastTouch = null;
    let touchMoved = false;

    canvas.addEventListener("touchstart", e => {
      e.preventDefault();
      const t = e.touches[0];
      lastTouch = { x: t.clientX, y: t.clientY };
      touchMoved = false;
      spawnTrail(t.clientX, t.clientY);
      if (settings.swipe) simulatePointer("pointerdown", t.clientX, t.clientY);
    }, { passive: false });

    canvas.addEventListener("touchmove", e => {
      e.preventDefault();
      const t = e.touches[0];
      touchMoved = true;
      spawnTrail(t.clientX, t.clientY);
      if (settings.swipe) simulatePointer("pointermove", t.clientX, t.clientY);
      lastTouch = { x: t.clientX, y: t.clientY };
    }, { passive: false });

    canvas.addEventListener("touchend", e => {
      e.preventDefault();
      if (!touchMoved && lastTouch && settings.tap) {
        const { x, y } = lastTouch;
        simulatePointer("pointerdown", x - 5, y);
        setTimeout(() => simulatePointer("pointermove", x, y), 16);
        setTimeout(() => simulatePointer("pointermove", x + 5, y), 32);
        setTimeout(() => simulatePointer("pointerup", x + 10, y), 48);
      } else if (lastTouch) {
        simulatePointer("pointerup", lastTouch.x, lastTouch.y);
      }
      lastTouch = null;
    }, { passive: false });

    // Prevent scroll & context menu
    document.body.addEventListener("touchmove", e => {
      if (e.target === canvas) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener("contextmenu", e => e.preventDefault());

    // Fullscreen on logo tap
    if (settings.fullscreen) {
      document.querySelector(".page-logo")?.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      });
    }

    // Keep canvas filling screen
    function handleResize() {
      canvas.style.width  = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }
    window.addEventListener("resize", handleResize);
    handleResize();
  }

  // ── Init ───────────────────────────────────────────────────────────────
  initSettingsPage();
  initGamePage();

  console.log("📱 Mobile system loaded!");
})();
