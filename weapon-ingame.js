// weapon-ingame.js — Cube Blaster power-up (ammo + auto-reload)
// Load AFTER shop.js, script.js, mechanics.js and items-ingame.js
// ============================================================================
(function () {
  "use strict";

  const WEAPON_MAX_AMMO  = 6;
  const WEAPON_RELOAD_MS = 3000; // short auto-reload delay once ammo hits 0

  function waitForGame(cb) {
    if (typeof resetGame === "function" && window.cgItems) { cb(); }
    else { setTimeout(() => waitForGame(cb), 100); }
  }

  waitForGame(() => {

    let _ammo = WEAPON_MAX_AMMO;
    let _reloading = false;
    let _reloadTimer = null;

    // ── Toast (separate tiny instance so this file has no dependency on
    //    items-ingame.js's internals) ─────────────────────────────────────
    function showToast(msg) {
      let t = document.getElementById("cgWeaponToast");
      if (!t) {
        t = document.createElement("div");
        t.id = "cgWeaponToast";
        t.style.cssText = `
          position:fixed; top:100px; left:50%; transform:translateX(-50%);
          background:rgba(10,15,30,0.92); border:1px solid rgba(255,87,34,0.5);
          color:#ff8a50; font-family:monospace; font-size:0.75rem; font-weight:bold;
          padding:8px 18px; border-radius:20px; z-index:9000; pointer-events:none;
          opacity:0; transition:opacity .3s; white-space:nowrap;
          letter-spacing:0.06em; text-shadow:0 0 8px rgba(255,138,80,0.6);
        `;
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.style.opacity = "1";
      clearTimeout(t._timer);
      t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2200);
    }

    // ── Button + ammo HUD ──────────────────────────────────────────────────
    function ensureButton() {
      if (document.getElementById("cgWeaponBtn")) return;
      const btn = document.createElement("button");
      btn.id = "cgWeaponBtn";
      btn.style.cssText = `
        position:fixed; bottom:140px; right:16px;
        background:rgba(255,87,34,0.2); border:1px solid #ff5722;
        color:#ff5722; font-family:monospace; font-size:0.7rem; font-weight:bold;
        padding:8px 14px; border-radius:8px; cursor:pointer; z-index:5000;
        letter-spacing:0.1em; text-shadow:0 0 8px #ff5722;
        transition:opacity .3s;
      `;
      btn.addEventListener("click", fireWeapon);
      document.body.appendChild(btn);
      updateButton();
    }

    function removeButton() {
      const btn = document.getElementById("cgWeaponBtn");
      if (btn) btn.remove();
    }

    function updateButton() {
      const btn = document.getElementById("cgWeaponBtn");
      if (!btn) return;
      if (_reloading) {
        btn.innerHTML = "🔄 RELOADING…";
        btn.style.opacity = "0.4";
        btn.style.cursor = "default";
      } else {
        btn.innerHTML = `🔫 FIRE (${_ammo}/${WEAPON_MAX_AMMO})`;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    }

    function findNearestBomb() {
      if (typeof targets === "undefined" || !targets) return null;
      let best = null;
      let bestY = -Infinity;
      for (const t of targets) {
        if (t && t.isBomb && !t.hit && t.y > bestY) { best = t; bestY = t.y; }
      }
      return best;
    }

    function fireWeapon() {
      if (!window.cgItems.hasItem("power_weapon")) return;
      if (typeof isInGame === "function" && !isInGame()) return;
      if (_reloading || _ammo <= 0) return;

      const bomb = findNearestBomb();
      if (!bomb) {
        showToast("🔫 No bomb in sight!");
        return; // don't waste ammo firing at nothing
      }

      _ammo--;
      updateButton();

      // Defuse the bomb — remove it before it can hit the player
      const idx = targets.indexOf(bomb);
      if (idx > -1) targets.splice(idx, 1);

      if (typeof sparkBurst === "function" && bomb.projected) {
        sparkBurst(bomb.projected.x || 0, bomb.projected.y || 0, 14, 8);
      }
      if (window.SOUND && window.SOUND.bombHit) window.SOUND.bombHit();
      showToast("🔫 Bomb destroyed!");

      if (_ammo <= 0) startReload();
    }

    function startReload() {
      _reloading = true;
      updateButton();
      clearTimeout(_reloadTimer);
      _reloadTimer = setTimeout(() => {
        _ammo = WEAPON_MAX_AMMO;
        _reloading = false;
        updateButton();
        showToast("🔫 Reloaded!");
      }, WEAPON_RELOAD_MS);
    }

    function resetWeaponState() {
      clearTimeout(_reloadTimer);
      _ammo = WEAPON_MAX_AMMO;
      _reloading = false;
      if (window.cgItems.hasItem("power_weapon")) {
        ensureButton();
        updateButton();
      } else {
        removeButton();
      }
    }

    // Apply on every new game (mirrors items-ingame.js's applyPowerUps pattern)
    resetWeaponState();
    if (typeof resetGame === "function" && !window._cgWeaponResetPatched) {
      window._cgWeaponResetPatched = true;
      const _origReset = resetGame;
      window.resetGame = function () {
        _origReset.apply(this, arguments);
        resetWeaponState();
      };
    }

    console.log("🔫 Cube Blaster ready — 6 shots, auto-reload");
  });

})();
