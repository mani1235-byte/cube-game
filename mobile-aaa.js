// mobile-aaa.js — CUBE GAME Phase 7: Mobile AAA Controls
// Smooth joystick, touch feedback, vibration, adaptive UI, aim assist
// ============================================================================
(function () {
  "use strict";

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || ("ontouchstart" in window)
    || window.innerWidth <= 768;

  if (!isMobile) {
    console.log("📱 MobileAAA: desktop detected, skipping");
    return;
  }

  // ── Inject CSS ────────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* ── Joystick ── */
    #aaa-joystick-zone {
      position: fixed;
      left: 0; bottom: 0;
      width: 180px; height: 180px;
      z-index: 200;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
    }
    #aaa-joystick-zone.active { opacity: 1; pointer-events: auto; }

    #aaa-joystick-base {
      position: absolute;
      width: 110px; height: 110px;
      left: 35px; bottom: 35px;
      border-radius: 50%;
      border: 2px solid rgba(103,215,240,0.35);
      background: rgba(0,0,0,0.25);
      backdrop-filter: blur(4px);
      box-shadow: 0 0 20px rgba(103,215,240,0.15), inset 0 0 20px rgba(0,0,0,0.3);
    }

    #aaa-joystick-knob {
      position: absolute;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, rgba(103,215,240,0.9), rgba(103,215,240,0.4));
      border: 1.5px solid rgba(255,255,255,0.4);
      box-shadow: 0 0 14px rgba(103,215,240,0.6);
      left: 33px; top: 33px;
      transition: transform 0.05s;
      pointer-events: none;
    }

    /* ── Touch ripple ── */
    .aaa-ripple {
      position: fixed;
      width: 48px; height: 48px;
      margin-left: -24px; margin-top: -24px;
      border-radius: 50%;
      border: 2px solid rgba(103,215,240,0.8);
      pointer-events: none;
      z-index: 250;
      animation: aaaRipple 0.5s ease-out forwards;
    }
    @keyframes aaaRipple {
      from { transform: scale(0.2); opacity: 1; }
      to   { transform: scale(2.2); opacity: 0; }
    }

    /* ── Aim assist ring ── */
    #aaa-aim-ring {
      position: fixed;
      width: 60px; height: 60px;
      margin-left: -30px; margin-top: -30px;
      border-radius: 50%;
      border: 1.5px solid rgba(103,215,240,0.55);
      pointer-events: none;
      z-index: 210;
      display: none;
      box-shadow: 0 0 10px rgba(103,215,240,0.3);
      transition: left 0.08s ease, top 0.08s ease;
    }
    #aaa-aim-ring::before {
      content: '';
      position: absolute;
      inset: 6px;
      border-radius: 50%;
      border: 1px solid rgba(103,215,240,0.3);
    }
    #aaa-aim-ring.locked {
      border-color: rgba(250,36,115,0.85);
      box-shadow: 0 0 14px rgba(250,36,115,0.5);
      animation: aimPulse 0.4s ease infinite alternate;
    }
    @keyframes aimPulse {
      from { transform: scale(1); }
      to   { transform: scale(1.12); }
    }

    /* ── Adaptive HUD ── */
    @media (max-width: 768px) {
      .hud__score    { font-size: clamp(18px, 5vw, 28px) !important; }
      .hud__lives    { font-size: clamp(14px, 3.5vw, 22px) !important; }
      .menu h1       { font-size: clamp(20px, 6vw, 36px) !important; }
      .menu button   { min-height: 52px; font-size: clamp(14px, 3.5vw, 18px) !important;
                       padding: 14px 28px !important; }
      .page-logo     { width: clamp(60px, 10vw, 90px) !important; }
    }

    /* ── Orientation lock notice ── */
    #aaa-orient {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.92);
      z-index: 9999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: rgba(103,215,240,0.9);
      font-family: 'Share Tech Mono', monospace;
      font-size: 16px; letter-spacing: 0.15em;
      gap: 20px;
      opacity: 0; pointer-events: none;
      transition: opacity 0.3s;
    }
    #aaa-orient.show { opacity: 1; pointer-events: auto; }
    #aaa-orient svg  { width: 52px; height: 52px; animation: rotateTip 1.5s ease infinite; }
    @keyframes rotateTip { 50% { transform: rotate(90deg); } }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════════════════
  // JOYSTICK
  // ═══════════════════════════════════════════════════════════════════════════
  const jZone = document.createElement("div"); jZone.id = "aaa-joystick-zone";
  const jBase = document.createElement("div"); jBase.id = "aaa-joystick-base";
  const jKnob = document.createElement("div"); jKnob.id = "aaa-joystick-knob";
  jBase.appendChild(jKnob);
  jZone.appendChild(jBase);
  document.body.appendChild(jZone);

  const JOYSTICK_RADIUS = 38;
  let jActive = false;
  let jOrigin = { x: 0, y: 0 };
  let jVector = { x: 0, y: 0 }; // -1..1 each axis

  function updateKnob(cx, cy) {
    const dx = cx - jOrigin.x;
    const dy = cy - jOrigin.y;
    const dist = Math.min(Math.hypot(dx, dy), JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * dist;
    const ky = Math.sin(angle) * dist;
    jKnob.style.transform = `translate(${kx}px, ${ky}px)`;
    jVector.x = kx / JOYSTICK_RADIUS;
    jVector.y = ky / JOYSTICK_RADIUS;
  }

  // Show joystick when game is active
  let joystickVisible = false;
  function showJoystick(show) {
    joystickVisible = show;
    jZone.classList.toggle("active", show);
    if (!show) {
      jKnob.style.transform = "";
      jVector.x = 0; jVector.y = 0;
    }
  }

  // Joystick → simulate swipe on game canvas
  const gameCanvas = document.getElementById("c");
  if (gameCanvas) {
    let jPointerActive = false;
    let jLastX = 0, jLastY = 0;

    // Touch on left third of screen = joystick
    gameCanvas.addEventListener("touchstart", e => {
      const t = e.touches[0];
      if (t.clientX < window.innerWidth * 0.4) {
        jOrigin = { x: t.clientX, y: t.clientY };
        jBase.style.left = (t.clientX - 55) + "px";
        jBase.style.bottom = (window.innerHeight - t.clientY - 55) + "px";
        jActive = true;
        jLastX = t.clientX; jLastY = t.clientY;
        showJoystick(true);
        vibrate(12);
      }
    }, { passive: true });

    gameCanvas.addEventListener("touchmove", e => {
      if (!jActive) return;
      const t = e.touches[0];
      updateKnob(t.clientX, t.clientY);

      // Translate joystick to pointer events on canvas
      const speed = 5;
      const nx = jLastX + jVector.x * speed;
      const ny = jLastY + jVector.y * speed;
      gameCanvas.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true,
        clientX: nx, clientY: ny,
        pointerId: 99, pointerType: "touch", isPrimary: true,
      }));
      jLastX = nx; jLastY = ny;
    }, { passive: true });

    gameCanvas.addEventListener("touchend", () => {
      if (jActive) { jActive = false; showJoystick(false); }
    }, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TOUCH RIPPLE FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════════
  function spawnRipple(x, y) {
    const r = document.createElement("div");
    r.className = "aaa-ripple";
    r.style.left = x + "px";
    r.style.top  = y + "px";
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 550);
  }

  document.addEventListener("touchstart", e => {
    const t = e.touches[0];
    spawnRipple(t.clientX, t.clientY);
  }, { passive: true });

  // ═══════════════════════════════════════════════════════════════════════════
  // HAPTIC VIBRATION
  // ═══════════════════════════════════════════════════════════════════════════
  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // Hook into game events for vibration feedback
  window.addEventListener("load", () => {
    // Cube slice → short pulse
    if (window.SOUND) {
      const origSlice = window.SOUND.slice;
      window.SOUND.slice = function() {
        origSlice?.();
        vibrate(18);
      };
      const origGameOver = window.SOUND.gameOver;
      window.SOUND.gameOver = function() {
        origGameOver?.();
        vibrate([60, 40, 80, 40, 120]); // game over pattern
      };
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AIM ASSIST
  // ═══════════════════════════════════════════════════════════════════════════
  const aimRing = document.createElement("div");
  aimRing.id = "aaa-aim-ring";
  document.body.appendChild(aimRing);

  let aimTarget = null;
  let aimRingVisible = false;

  function findNearestTarget(x, y) {
    // Look for projected target positions from game state
    // Targets expose their screen positions via _cgTargetPositions (set below)
    const targets = window._cgTargetPositions || [];
    let best = null, bestDist = 80; // snap radius px
    targets.forEach(t => {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestDist) { bestDist = d; best = t; }
    });
    return best;
  }

  document.addEventListener("touchmove", e => {
    const t = e.touches[0];
    const near = findNearestTarget(t.clientX, t.clientY);
    if (near) {
      aimRing.style.display = "block";
      aimRing.style.left = near.x + "px";
      aimRing.style.top  = near.y + "px";
      aimRing.classList.add("locked");
      aimTarget = near;
    } else {
      aimRing.classList.remove("locked");
      aimRing.style.left = t.clientX + "px";
      aimRing.style.top  = t.clientY + "px";
      aimRing.style.display = "block";
      aimTarget = null;
    }
  }, { passive: true });

  document.addEventListener("touchend", () => {
    setTimeout(() => { aimRing.style.display = "none"; aimTarget = null; }, 200);
  }, { passive: true });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPOSE TARGET POSITIONS (patch into game tick)
  // ═══════════════════════════════════════════════════════════════════════════
  window.addEventListener("load", () => {
    const origTick = window.tick;
    if (typeof origTick !== "function") return;
    window.tick = function(w, h, st, ss, lag) {
      origTick(w, h, st, ss, lag);
      try {
        const vScale = window._cgViewScale || (window.innerHeight / 1000);
        const halfW  = window._cgHalfW    || (window.innerWidth / 2);
        const halfH  = window._cgHalfH    || (window.innerHeight / 2);
        // targets is global in script.js
        if (typeof targets !== "undefined") {
          window._cgTargetPositions = targets
            .filter(t => !t.removed)
            .map(t => ({
              x: (t.projected.x + halfW) * vScale,
              y: (t.projected.y + halfH) * vScale,
            }));
        }
      } catch(e) {}
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ORIENTATION LOCK NOTICE
  // ═══════════════════════════════════════════════════════════════════════════
  const orientEl = document.createElement("div");
  orientEl.id = "aaa-orient";
  orientEl.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <path d="M12 18h.01"/>
    </svg>
    <span>ROTATE TO LANDSCAPE</span>
  `;
  document.body.appendChild(orientEl);

  function checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    orientEl.classList.toggle("show", portrait && !!gameCanvas);
  }
  window.addEventListener("resize", checkOrientation);
  checkOrientation();

  console.log("📱 MobileAAA Phase 7 loaded!");
})();
