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
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 8px;
      z-index: 1000;
      pointer-events: none;
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

  // Competition HUD
  const compHud = document.createElement("div");
  compHud.id = "compHud";
  compHud.innerHTML = `
    <div id="compTimerEl">0:00</div>
    <div id="compScores">
      <span id="compYou">YOU: 0</span>
      <span id="compOpp">OPP: 0</span>
    </div>
  `;
  document.body.appendChild(compHud);

  // Competition result overlay
  const compResult = document.createElement("div");
  compResult.id = "compResult";
  compResult.innerHTML = `
    <div id="compResultTitle"></div>
    <div id="compResultCoins"></div>
    <div class="comp-result-btns">
      <button id="compResultBtn">🔄 PLAY AGAIN</button>
      <button id="compNoThanksBtn">✕ NO THANKS</button>
    </div>
  `;
  document.body.appendChild(compResult);

  // Add competition button to main menu
  const mainMenu = document.querySelector(".menu--main");
  if (mainMenu) {
    const compBtn = document.createElement("button");
    compBtn.type = "button";
    compBtn.className = "play-comp-btn";
    compBtn.textContent = "⚔️ Competition";
    compBtn.addEventListener("click", startCompetition);
    mainMenu.appendChild(compBtn);
  }

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
          loseHeart();
          if (window.SOUND) window.SOUND.bombHit();
        } else {
          if (Math.random() < HEART_CHANCE) {
            gainHeart();
            if (window.SOUND) window.SOUND.heartGain();
          }
        }
      }
    });

    // Update competition scores
    if (compMode) {
      const youEl = document.getElementById("compYou");
      const oppEl = document.getElementById("compOpp");
      if (youEl) youEl.textContent = `YOU: ${state.game.score}`;
      if (oppEl) oppEl.textContent = `OPP: ${compOppScore}`;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  //  COMPETITION MODE
  // ═══════════════════════════════════════════════════════════════════════════

  function startCompetition() {
    competitionEnded = false;
    lastPlayedMode = "competition"; // ← set here so it's always tracked
    compDuration = Math.floor(Math.random() * 61) + 30; // 30–90 seconds
    compTimer    = compDuration;
    compOppScore = 0;
    compMode     = true;

    resetHearts();
    lastTargetsLen = 0;
    setGameMode(GAME_MODE_RANKED);
    setActiveMenu(null);

    compHud.classList.add("active");

    compInterval = setInterval(() => {
      compTimer--;
      compOppScore += Math.floor(Math.random() * 8); // max 8 per second — fair & beatable

      const mins = Math.floor(compTimer / 60);
      const secs = compTimer % 60;
      const timerEl = document.getElementById("compTimerEl");
      if (timerEl) {
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
        timerEl.classList.toggle("urgent", compTimer <= 10);
      }

      if (compTimer <= 0) endCompetition();
    }, 1000);
  }

  function stopCompetition() {
    clearInterval(compInterval);
    compInterval = null;
    compMode     = false;
    compHud.classList.remove("active");
  }

  let competitionEnded = false;

  function endCompetition() {
    if (competitionEnded) return;
    competitionEnded = true;
    stopCompetition();

    const yourScore = state.game.score;
    const titleEl   = document.getElementById("compResultTitle");
    const coinsEl   = document.getElementById("compResultCoins");

    let coins = 0;
    try {
      const user = JSON.parse(localStorage.getItem("cg_current_user"));
      if (user) coins = user.coins || 0;
    } catch(e) {}

    if (yourScore > compOppScore) {
      titleEl.textContent = "YOU WIN! 🏆";
      titleEl.className   = "win";
      coinsEl.textContent = `+${COMP_COINS} coins! Total: ${coins + COMP_COINS}`;
      saveCoins(COMP_COINS);
      if (window.SOUND) window.SOUND.win();
    } else if (yourScore < compOppScore) {
      titleEl.textContent = "YOU LOSE 😢";
      titleEl.className   = "lose";
      coinsEl.textContent = `-${COMP_COINS} coins. Total: ${Math.max(0, coins - COMP_COINS)}`;
      saveCoins(-COMP_COINS);
      if (window.SOUND) window.SOUND.gameOver();
    } else {
      titleEl.textContent = "DRAW! 🤝";
      titleEl.className   = "draw";
      coinsEl.textContent = "No coins lost or gained.";
    }

    // Trophies & XP — same independent pattern as the main endGame() bridge
    // (progression/progression-game-bridge.js): both fire off the match
    // result, neither system talks to the other.
    try {
      if (window.CGTrophies) {
        const trophyInfo = window.CGTrophies.applyMatchResult(yourScore);
        window.CGTrophies.renderMatchResult(trophyInfo);
      }
    } catch (e) {}
    try {
      if (window.CGXP) {
        const xpInfo = window.CGXP.applyMatchResult(yourScore);
        window.CGXP.renderMatchResult(xpInfo);
      }
    } catch (e) {}

    compResult.classList.add("show");
    setActiveMenu(MENU_SCORE);
  }

  function saveCoins(delta) {
    try {
      const key  = "cg_current_user";
      const user = JSON.parse(localStorage.getItem(key));
      if (!user) return;
      user.coins = Math.max(0, (user.coins || 0) + delta);
      localStorage.setItem(key, JSON.stringify(user));
      const users = JSON.parse(localStorage.getItem("cg_users") || "{}");
      if (users[user.username.toLowerCase()]) {
        users[user.username.toLowerCase()].coins = user.coins;
        localStorage.setItem("cg_users", JSON.stringify(users));
      }
    } catch(e) {}
  }

  // ── Patch setActiveMenu — stop competition whenever any menu shows ─────────
  const _originalSetActiveMenu = setActiveMenu;
  window.setActiveMenu = function(menu) {
    if (menu === MENU_MAIN || menu === MENU_SCORE) {
      stopCompetition();
    }
    _originalSetActiveMenu(menu);
  };

  // Track last played mode
  let lastPlayedMode = "normal";

  // ── Patch resetGame — intercept play again for competition ────────────
  const _origResetGame = resetGame;
  window.resetGame = function() {
    if (lastPlayedMode === "competition") {
      // Don't reset normally — start competition instead
      setTimeout(() => {
        compResult.classList.remove("show");
        startCompetition();
      }, 50);
      return;
    }
    _origResetGame();
  };

  // Stop competition if player quits to menu
  document.querySelector(".menu-btn--pause")?.addEventListener("click", () => {
    if (compMode) {
      stopCompetition();
      compResult.classList.remove("show");
      resetHearts();
    }
  });

  document.querySelector(".play-normal-btn")?.addEventListener("click", () => {
    lastPlayedMode = "normal";
    if (compMode) { stopCompetition(); compResult.classList.remove("show"); }
    resetHearts(); lastTargetsLen = 0;
  });

  document.querySelector(".play-casual-btn")?.addEventListener("click", () => {
    lastPlayedMode = "casual";
    if (compMode) { stopCompetition(); compResult.classList.remove("show"); }
    resetHearts(); lastTargetsLen = 0;
  });

  // Play again — restarts competition if that was last mode
  document.querySelector(".play-again-btn")?.addEventListener("click", () => {
    compResult.classList.remove("show");
    if (lastPlayedMode === "competition") {
      setTimeout(() => startCompetition(), 100);
      return;
    }
    if (compMode) { stopCompetition(); }
    resetHearts(); lastTargetsLen = 0;
  });

  // Close result — restart competition directly
  document.getElementById("compResultBtn").addEventListener("click", () => {
    compResult.classList.remove("show");
    startCompetition();
  });

  // No thanks — go to main menu
  document.getElementById("compNoThanksBtn").addEventListener("click", () => {
    compResult.classList.remove("show");
    lastPlayedMode = "normal";
    resetHearts();
    lastTargetsLen = 0;
    setActiveMenu(MENU_MAIN);
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  updateHeartsHud();
  console.log("💣 Mechanics loaded — 4% bombs, 20% heart gain, competition mode ready!");

})();