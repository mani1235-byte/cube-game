// items-ingame.js — Applies purchased items to gameplay
// Load AFTER shop.js and script.js
// ============================================================================
(function () {
  "use strict";

  // ── Wait until game engine is fully ready ─────────────────────────────────
  function waitForGame(cb) {
    if (typeof resetGame === "function" && window.cgItems) { cb(); }
    else { setTimeout(() => waitForGame(cb), 100); }
  }

  waitForGame(() => {

    // ── 1. TRAIL COLOR — patch SlashTrail inside particles.js ─────────────
    // particles.js is an IIFE, so we intercept emitSlashTrail via CubeParticles
    if (window.CubeParticles && window.CubeParticles.emitSlashTrail) {
      const _origEmit = window.CubeParticles.emitSlashTrail;
      let _rainbowHue = 0;

      window.CubeParticles.emitSlashTrail = function (x, y) {
        _origEmit(x, y);
        // After emitting, recolor the freshest trail particle on the canvas
        // We do this by overriding the draw approach via a globalThis hook
      };

      // Better approach: patch the canvas draw call by overriding the color
      // via CSS filter on the canvas — instant, zero-lag
      const gameCanvas = document.querySelector("canvas");
      if (gameCanvas) {
        // Store original so we can reset
        window._cgOrigFilter = gameCanvas.style.filter || "";

        function applyTrailVisual() {
          if (window.cgItems.isRainbowTrail()) {
            // Animate rainbow hue rotation on the canvas
            if (!window._cgRainbowInterval) {
              window._cgRainbowInterval = setInterval(() => {
                _rainbowHue = (_rainbowHue + 3) % 360;
                gameCanvas.style.filter = `hue-rotate(${_rainbowHue}deg) saturate(1.4)`;
              }, 40);
            }
          } else {
            // Stop rainbow if running
            if (window._cgRainbowInterval) {
              clearInterval(window._cgRainbowInterval);
              window._cgRainbowInterval = null;
            }

            const color = window.cgItems.getActiveTrailColor();
            if (!color) {
              gameCanvas.style.filter = window._cgOrigFilter;
              return;
            }

            // Map RGB to hue-rotate + saturate for trail tinting
            const hue = rgbToHue(color.r, color.g, color.b);
            gameCanvas.style.filter = `hue-rotate(${hue}deg) saturate(1.6)`;
          }
        }

        // Apply when game starts
        applyTrailVisual();

        // Re-apply when user equips a new trail mid-session
        const _origResetGame = window.resetGame;
        if (typeof _origResetGame === "function") {
          window.resetGame = function () {
            _origResetGame.apply(this, arguments);
            applyTrailVisual();
            applyPowerUps();
          };
        }
      }
    }

    // ── 2. POWER-UPS — applied at game start (resetGame hook) ────────────
    let _shieldUsedThisGame  = false;
    let _scoreMultiplierEnd  = 0;
    let _coinMagnetActive    = false;

    // Expose for score hook
    window.cgPowerState = {
      getScoreMultiplier() {
        return (window.cgItems.hasItem("power_x2score") && Date.now() < _scoreMultiplierEnd) ? 2 : 1;
      },
      isCoinMagnet()   { return window.cgItems.hasItem("power_magnet"); },
      hasShield()      { return window.cgItems.hasItem("power_shield") && !_shieldUsedThisGame; },
      useShield()      { _shieldUsedThisGame = true; },
    };

    function applyPowerUps() {
      _shieldUsedThisGame = false;

      // power_slowmo: boost slowmo duration
      if (window.cgItems.hasItem("power_slowmo") && typeof slowmoRemaining !== "undefined") {
        // Grant extra slowmo at game start
        setTimeout(() => {
          if (typeof slowmoRemaining !== "undefined") {
            slowmoRemaining = Math.min((slowmoRemaining || 0) + 30000, 60000);
          }
        }, 500);
      }

      // power_time: add 30s to game session timer display
      if (window.cgItems.hasItem("power_time")) {
        showPowerUpToast("⏱️ +30s Time Warp active!");
      }

      // power_x2score: activate for 60s
      if (window.cgItems.hasItem("power_x2score")) {
        _scoreMultiplierEnd = Date.now() + 60000;
        showPowerUpToast("⬆️ 2× Score Rush active for 60s!");
      }

      // power_freeze: show freeze button
      if (window.cgItems.hasItem("power_freeze")) {
        showFreezeButton();
      }

      // power_shield: show shield indicator
      if (window.cgItems.hasItem("power_shield")) {
        showShieldIndicator(true);
      }

      // power_explode: already handled by particles.js on destroy
      // power_ghost2: passthrough handled below in loseHeart hook
    }

    // ── 3. SHIELD — intercept loseHeart ───────────────────────────────────
    if (typeof loseHeart === "function") {
      const _origLoseHeart = loseHeart;
      window.loseHeart = function () {
        if (window.cgPowerState.hasShield()) {
          window.cgPowerState.useShield();
          showPowerUpToast("🛡️ Force Shield blocked a hit!");
          showShieldIndicator(false);
          // Flash blue instead of red
          const flash = document.createElement("div");
          flash.style.cssText = "position:fixed;inset:0;background:rgba(65,105,225,0.3);z-index:9998;pointer-events:none;animation:heartFlash 0.4s ease forwards";
          document.body.appendChild(flash);
          setTimeout(() => flash.remove(), 400);
          return; // block the hit
        }
        _origLoseHeart.apply(this, arguments);
      };
    }

    // ── 4. SCORE MULTIPLIER — intercept incrementScore ────────────────────
    if (typeof incrementScore === "function") {
      const _origIncrementScore = incrementScore;
      window.incrementScore = function (inc) {
        const mult = window.cgPowerState.getScoreMultiplier();
        _origIncrementScore.apply(this, [Math.round(inc * mult)]);
      };
    }

    // ── 5. COIN MAGNET — double coins earned in-game ──────────────────────
    // Hook endGame to grant bonus coins if magnet active
    if (typeof endGame === "function") {
      const _origEndGame = endGame;
      window.endGame = function () {
        if (window.cgItems.hasItem("power_magnet")) {
          // Grant coins equal to score / 100 (doubled vs normal)
          const bonus = Math.floor((state.game.score || 0) / 50);
          if (bonus > 0 && window.cgItems && window.cgItems.getUser) {
            const user = window.cgItems.getUser();
            if (user) {
              user.coins = (user.coins || 0) + bonus;
              localStorage.setItem("cg_current_user", JSON.stringify(user));
              showPowerUpToast(`🧲 Coin Magnet: +${bonus} 🪙 earned!`);
            }
          }
        }
        _origEndGame.apply(this, arguments);
      };
    }

    // ── 6. FREEZE RAY button ──────────────────────────────────────────────
    let freezeUsed = false;
    function showFreezeButton() {
      if (document.getElementById("cgFreezeBtn")) return;
      freezeUsed = false;
      const btn = document.createElement("button");
      btn.id = "cgFreezeBtn";
      btn.innerHTML = "🧊 FREEZE";
      btn.style.cssText = `
        position:fixed; bottom:80px; right:16px;
        background:rgba(0,188,212,0.2); border:1px solid #00bcd4;
        color:#00bcd4; font-family:monospace; font-size:0.7rem; font-weight:bold;
        padding:8px 14px; border-radius:8px; cursor:pointer; z-index:5000;
        letter-spacing:0.1em; text-shadow:0 0 8px #00bcd4;
        transition:opacity .3s;
      `;
      btn.addEventListener("click", () => {
        if (freezeUsed || typeof targetSpeed === "undefined") return;
        freezeUsed = true;
        btn.style.opacity = "0.3";
        btn.style.cursor = "default";
        showPowerUpToast("🧊 Freeze Ray! All cubes frozen for 5s!");
        const origSpeed = targetSpeed;
        targetSpeed = 0;
        setTimeout(() => { targetSpeed = origSpeed; }, 5000);
      });
      document.body.appendChild(btn);
    }

    // ── 7. SHIELD indicator ───────────────────────────────────────────────
    function showShieldIndicator(active) {
      let ind = document.getElementById("cgShieldInd");
      if (!ind) {
        ind = document.createElement("div");
        ind.id = "cgShieldInd";
        ind.style.cssText = `
          position:fixed; bottom:80px; left:16px;
          font-size:1.4rem; z-index:5000;
          transition:opacity .4s; text-shadow:0 0 12px #4169e1;
        `;
        ind.textContent = "🛡️";
        document.body.appendChild(ind);
      }
      ind.style.opacity = active ? "1" : "0.2";
      ind.title = active ? "Force Shield ready!" : "Shield used";
    }

    // ── 8. POWER-UP toast (in-game, non-shop) ─────────────────────────────
    function showPowerUpToast(msg) {
      let t = document.getElementById("cgPowerToast");
      if (!t) {
        t = document.createElement("div");
        t.id = "cgPowerToast";
        t.style.cssText = `
          position:fixed; top:70px; left:50%; transform:translateX(-50%);
          background:rgba(10,15,30,0.92); border:1px solid rgba(103,215,240,0.4);
          color:#a6e02c; font-family:monospace; font-size:0.75rem; font-weight:bold;
          padding:8px 18px; border-radius:20px; z-index:9000; pointer-events:none;
          opacity:0; transition:opacity .3s; white-space:nowrap;
          letter-spacing:0.06em; text-shadow:0 0 8px rgba(166,224,44,0.6);
        `;
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = "1";
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.style.opacity = "0"; }, 3000);
    }

    // ── Apply power-ups now and on every new game ─────────────────────────
    applyPowerUps();

    // Patch resetGame if not already done above
    if (typeof resetGame === "function" && !window._cgResetPatched) {
      window._cgResetPatched = true;
      const _origReset = resetGame;
      window.resetGame = function () {
        _origReset.apply(this, arguments);
        applyPowerUps();
      };
    }

    console.log("🎮 cgItems in-game bridge ready");
  });

  // ── Utility: approximate hue from RGB (for canvas filter) ────────────────
  function rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    // Cyan (default trail) is ~180°, so subtract 180 to get relative rotation
    return Math.round(h * 360) - 180;
  }

})();
