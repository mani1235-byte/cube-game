// mechanics.js
// DEPENDS ON: script.js (must load after it)
// Adds: 💣 Bomb cubes, ❤️ Hearts system
// ============================================================================

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────
  const BOMB_COLOR   = { r: 0xff, g: 0x22, b: 0x00 };
  const BOMB_CHANCE  = 0.04; // 4% chance — rare enough to be surprising
  const HEART_CHANCE = 0.20; // 20% chance of +1 heart on cube destroy
  const MAX_HEARTS   = 3;

  // ── State ──────────────────────────────────────────────────────────────────
  let hearts         = MAX_HEARTS;
  let lastTargetsLen = 0;

  // ═══════════════════════════════════════════════════════════════════════════
  //  STYLES
  // ═══════════════════════════════════════════════════════════════════════════
  const style = document.createElement("style");
  style.textContent = `
    #heartsHud {
      /* Superseded by the real 150-HP bar rendered by script.js's
         renderHearts(); kept in the DOM (unused) so nothing else that
         references #heartsHud/#heart1-3 breaks, but hidden visually. */
      display: none !important;
    }
    .heart {
      font-size: clamp(20px, 4vw, 28px);
      filter: drop-shadow(0 0 6px rgba(255,50,50,0.7));
      transition: transform 0.2s, filter 0.2s;
    }
    .heart.lost {
      filter: grayscale(1) opacity(0.3);
      transform: scale(0.8);
    }
    .heart-flash {
      position: fixed;
      inset: 0;
      background: rgba(255,0,0,0.25);
      z-index: 8000;
      pointer-events: none;
      animation: heartFlash 0.4s ease forwards;
    }
    @keyframes heartFlash {
      0%   { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════════════════
  //  BUILD HUD ELEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  // Hearts HUD
  const heartsHud = document.createElement("div");
  heartsHud.id = "heartsHud";
  heartsHud.innerHTML = `
    <span class="heart" id="heart1">❤️</span>
    <span class="heart" id="heart2">❤️</span>
    <span class="heart" id="heart3">❤️</span>
  `;
  document.body.appendChild(heartsHud);

  // ═══════════════════════════════════════════════════════════════════════════
  //  HEARTS
  // ═══════════════════════════════════════════════════════════════════════════

  function updateHeartsHud() {
    for (let i = 1; i <= MAX_HEARTS; i++) {
      const el = document.getElementById(`heart${i}`);
      if (el) el.classList.toggle("lost", i > hearts);
    }
  }

  function loseHeart() {
    if (hearts <= 0) return;
    hearts--;
    updateHeartsHud();
    const flash = document.createElement("div");
    flash.className = "heart-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
    if (hearts <= 0) {
      endGame();
    }
  }

  function gainHeart() {
    if (hearts >= MAX_HEARTS) return;
    hearts++;
    updateHeartsHud();
  }

  function resetHearts() {
    hearts = MAX_HEARTS;
    updateHeartsHud();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  BOMB SPAWNING — check for new targets each tick
  // ═══════════════════════════════════════════════════════════════════════════

  function checkForNewTargets() {
    if (!targets || targets.length <= lastTargetsLen) return;
    for (let i = lastTargetsLen; i < targets.length; i++) {
      const t = targets[i];
      if (!t || t.wireframe) continue;
      if (Math.random() < BOMB_CHANCE) {
        t.isBomb = true;
        if (t.polys) {
          t.polys.forEach(p => { p.color = BOMB_COLOR; });
        }
      }
    }
    lastTargetsLen = targets.length;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PATCH TICK — detect hits, bombs, hearts
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Patch tick — remove bombs silently before offscreen endGame check ──────
  const _originalTick = tick;

  window.tick = function (width, height, simTime, simSpeed, lag) {
    // Stop all mechanics if any menu is active
    if (!isInGame()) {
      _originalTick(width, height, simTime, simSpeed, lag);
      return;
    }

    // Remove bombs silently before offscreen check
    if (targets) {
      const centerY = height / 2;
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        if (t.isBomb && !t.hit && t.y > centerY + 80) {
          targets.splice(i, 1);
          lastTargetsLen = targets.length;
        }
      }
    }

    // Snapshot hit state before tick
    const prevHits = targets ? targets.map(t => ({ ref: t, wasHit: !!t.hit })) : [];

    _originalTick(width, height, simTime, simSpeed, lag);

    // Check new targets spawned this tick
    checkForNewTargets();
    if (targets) lastTargetsLen = targets.length;

    // Detect newly hit targets
    prevHits.forEach(({ ref, wasHit }) => {
      if (!wasHit && ref.hit) {
        if (ref.isBomb) {
          if (window.SOUND) window.SOUND.bombHit();
        } else {
          if (Math.random() < HEART_CHANCE) {
            if (window.SOUND) window.SOUND.heartGain();
          }
        }
      }
    });
  };

  // ── Mode-switch handling — reset hearts on fresh starts ────────────────────
  document.addEventListener("click", (e) => {
    if (e.target.closest(".play-normal-btn") || e.target.closest(".play-casual-btn")) {
      resetHearts(); lastTargetsLen = 0;
    } else if (e.target.closest(".menu-btn--pause") || e.target.closest(".menu-btn--score")) {
      resetHearts();
    }
  }, true);

  document.querySelector(".play-again-btn")?.addEventListener("click", () => {
    resetHearts(); lastTargetsLen = 0;
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  updateHeartsHud();
  console.log("💣 Mechanics loaded — 4% bombs, 20% heart gain");

})();
