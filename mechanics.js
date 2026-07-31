// mechanics.js
// DEPENDS ON: script.js (must load after it)
// Adds: 💣 Bomb cubes, ❤️ Hearts system, ⚔️ Competition mode
// ============================================================================

(function () {
  "use strict";

  // ── Constants ──────────────────────────────────────────────────────────────
  const BOMB_COLOR   = { r: 0xff, g: 0x22, b: 0x00 };
  const BOMB_CHANCE  = 0.04; // 4% chance — rare enough to be surprising
  const HEART_CHANCE = 0.20; // 20% chance of +1 heart on cube destroy
  const MAX_HEARTS   = 3;
  const COMP_COINS   = 50;

  // ── State ──────────────────────────────────────────────────────────────────
  let hearts        = MAX_HEARTS;
  let compMode      = false;
  let compTimer     = 0;
  let compDuration  = 0;
  let compOppScore  = 0;
  let compInterval  = null;
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
    #compHud {
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 1000;
      pointer-events: none;
    }
    #compHud.active { display: flex; }
    #compTimerEl {
      font-family: monospace;
      font-size: clamp(1.4rem, 4vw, 2rem);
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 20px rgba(103,215,240,0.8);
      letter-spacing: 0.1em;
    }
    #compTimerEl.urgent {
      color: #ff4444;
      animation: timerPulse 0.5s ease infinite alternate;
    }
    @keyframes timerPulse {
      from { transform: scale(1); }
      to   { transform: scale(1.1); }
    }
    #compScores {
      display: flex;
      gap: 20px;
      font-family: monospace;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
    }
    #compYou  { color: #a6e02c; }
    #compOpp  { color: #fa2473; }
    #compResult {
      position: fixed;
      inset: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.8);
      z-index: 9000;
      font-family: monospace;
      text-align: center;
      gap: 10px;
      animation: fadeIn 0.4s ease;
    }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    #compResult.show { display: flex; }
    #compResultTitle {
      font-size: clamp(1.8rem, 5vw, 3rem);
      font-weight: 900;
      letter-spacing: 0.1em;
    }
    #compResultTitle.win  { color: #a6e02c; text-shadow: 0 0 40px rgba(166,224,44,0.7); }
    #compResultTitle.lose { color: #ff4444; text-shadow: 0 0 40px rgba(255,68,68,0.7); }
    #compResultTitle.draw { color: #fe9522; text-shadow: 0 0 40px rgba(254,149,34,0.7); }
    #compResultCoins { font-size: 0.9rem; color: rgba(255,255,255,0.7); letter-spacing: 0.06em; }
    .comp-result-btns { display: flex; gap: 10px; margin-top: 6px; }
    #compResultBtn {
      padding: 10px 24px;
      background: linear-gradient(135deg, rgba(103,215,240,0.25), rgba(166,224,44,0.2));
      border: 1px solid rgba(103,215,240,0.5);
      border-radius: 10px;
      color: #fff;
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: bold;
      letter-spacing: 0.1em;
      cursor: pointer;
      transition: all 0.2s;
    }
    #compResultBtn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(103,215,240,0.3); }
    #compNoThanksBtn {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 10px;
      color: rgba(255,255,255,0.45);
      font-family: monospace;
      font-size: 0.85rem;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.2s;
    }
    #compNoThanksBtn:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.35); }
    .play-comp-btn {
      display: block;
      position: relative;
      width: 200px;
      padding: 12px 20px;
      background: transparent;
      border: none;
      outline: none;
      font-family: monospace;
      font-weight: bold;
      font-size: 1.4rem;
      color: #fe9522;
      opacity: 0.75;
      cursor: pointer;
      transition: opacity 0.3s;
      letter-spacing: 0.06em;
    }
    .play-comp-btn:hover { opacity: 1; }
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
      // No bombs in competition mode
      if (compMode) continue;
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
          // In split-screen competition, destroying a bomb immediately loses.
          // Normal gameplay keeps its existing heart/HP behavior.
          if (window.SOUND) window.SOUND.bombHit();
        } else {
          if (Math.random() < HEART_CHANCE) {
            if (window.SOUND) window.SOUND.heartGain();
          }
        }
      }
    });
};


  // ── Init ───────────────────────────────────────────────────────────────────
  updateHeartsHud();
  console.log("💣 Mechanics loaded — normal mode ready!");

})();