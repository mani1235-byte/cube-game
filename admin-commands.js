// Cube Game owner-only admin commands.
// NOTE: This client-side gate is suitable for local/admin tooling, but it is
// NOT a security boundary for a public multiplayer backend. Use Firebase
// custom claims/server validation for authoritative admin powers.
(function () {
  "use strict";

  const OWNER_NAMES = new Set(["cube game", "owner of cube game"]);
  const OWNER_PROFILE_MARKERS = new Set(["cube game", "cube-game"]);
  let adminEnabled = false;

  function getUser() {
    try { return JSON.parse(localStorage.getItem("cg_current_user")) || null; }
    catch (_) { return null; }
  }

  function isOwner() {
    const user = getUser();
    if (!user || user.isGuest) return false;
    const username = String(user.username || "").trim().toLowerCase();
    const profile = String(user.profileName || user.profile || user.appProfile || "").trim().toLowerCase();
    return OWNER_NAMES.has(username) || OWNER_PROFILE_MARKERS.has(profile) || user.isCubeGameOwner === true;
  }

  function getProgressionState() {
    return window.ProgressionManager?.getState?.() || null;
  }

  function saveProgression() {
    try { window.ProgressionEvents?.emit?.("progression:dirty"); } catch (_) {}
  }

  function output(message) {
    let box = document.getElementById("cg-admin-output");
    if (!box) {
      box = document.createElement("div");
      box.id = "cg-admin-output";
      box.style.cssText = "position:fixed;left:18px;bottom:18px;z-index:100000;background:rgba(4,8,20,.96);border:1px solid rgba(0,220,255,.45);border-radius:12px;padding:12px 14px;color:#dffaff;font:13px/1.45 monospace;max-width:420px;box-shadow:0 12px 40px rgba(0,0,0,.45);pointer-events:none";
      document.body.appendChild(box);
    }
    box.textContent = "ADMIN › " + message;
    clearTimeout(box._timer);
    box._timer = setTimeout(() => box.remove(), 4500);
  }

  function setWorld(id) {
    if (!window.WorldSystem?.travelTo?.(id)) return output("World is locked or unknown: " + id);
    output("World changed to " + id);
  }

  function setDifficulty(id) {
    if (!window.DifficultySystem?.select?.(id)) return output("Difficulty is locked or unknown: " + id);
    output("Difficulty changed to " + id);
  }

  function run(raw) {
    if (!adminEnabled || !isOwner()) return;
    const parts = raw.trim().split(/\s+/);
    const cmd = (parts.shift() || "").toLowerCase();
    const arg = parts.shift();
    const state = getProgressionState();

    if (cmd === "help") {
      return output("/admin world <id> | difficulty <id> | boost <1/2/4/8/16> | coins <n> | xp <n> | trophies <n> | heal | clear");
    }
    if (cmd === "world") return setWorld((arg || "").toLowerCase());
    if (cmd === "difficulty") return setDifficulty((arg || "").toLowerCase());
    if (cmd === "boost") {
      const n = Number(arg);
      if (![1,2,4,8,16].includes(n)) return output("Boost must be 1, 2, 4, 8 or 16.");
      window.CubeGameAdminBoost = n;
      output("Temporary reward boost set to " + n + "x");
      return;
    }
    if (cmd === "coins") {
      const n = Math.max(0, Math.floor(Number(arg)) || 0);
      if (window.CoinSystem?.add) window.CoinSystem.add(n, "admin");
      else if (state) state.coins = (state.coins || 0) + n;
      saveProgression(); output("Added " + n + " coins."); return;
    }
    if (cmd === "xp") {
      const n = Math.max(0, Math.floor(Number(arg)) || 0);
      if (window.XPSystem?.add) window.XPSystem.add(n, "admin");
      output("Added " + n + " XP."); return;
    }
    if (cmd === "trophies") {
      const n = Math.max(0, Math.floor(Number(arg)) || 0);
      if (window.TrophySystem?.add) window.TrophySystem.add(n);
      output("Added " + n + " trophies."); return;
    }
    if (cmd === "heal") {
      if (typeof MAX_HP !== "undefined") { currentHP = MAX_HP; if (typeof renderHearts === "function") renderHearts(); }
      output("HP restored."); return;
    }
    if (cmd === "clear") {
      if (typeof resetAllTargets === "function") resetAllTargets();
      output("All active cubes cleared."); return;
    }
    output("Unknown command. Use /admin help.");
  }

  function init() {
    adminEnabled = isOwner();
    if (!adminEnabled) return;
    window.CubeGameAdmin = { enabled: true, run };
    document.addEventListener("keydown", (event) => {
      if (!event.key || event.key.length !== 1) return;
      // Admin commands are typed as /admin ... in any focused text input.
      const el = document.activeElement;
      if (!el || !(el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.key === "Enter" && String(el.value || "").trim().toLowerCase().startsWith("/admin")) {
        const command = el.value.trim().replace(/^\/admin\s*/i, "");
        el.value = "";
        run(command);
        event.preventDefault();
      }
    });
    output("Owner commands enabled. Type /admin help in a text field.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
