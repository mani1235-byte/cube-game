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

  function createAdminPanel() {
    if (document.getElementById("cg-admin-button")) return;

    const button = document.createElement("button");
    button.id = "cg-admin-button";
    button.type = "button";
    button.textContent = "ADMIN";
    button.style.cssText = [
      "position:fixed", "right:18px", "bottom:18px", "z-index:100001",
      "padding:11px 18px", "border:1px solid rgba(0,220,255,.7)",
      "border-radius:10px", "background:rgba(4,12,28,.96)",
      "color:#dffaff", "font:700 12px/1 monospace", "letter-spacing:.12em",
      "cursor:pointer", "box-shadow:0 8px 28px rgba(0,0,0,.4)"
    ].join(";");

    const panel = document.createElement("div");
    panel.id = "cg-admin-panel";
    panel.hidden = true;
    panel.style.cssText = [
      "position:fixed", "right:18px", "bottom:66px", "z-index:100002",
      "width:min(420px,calc(100vw - 36px))", "padding:14px",
      "background:rgba(4,8,20,.98)", "border:1px solid rgba(0,220,255,.45)",
      "border-radius:14px", "box-shadow:0 16px 50px rgba(0,0,0,.55)"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "CUBE GAME ADMIN";
    title.style.cssText = "color:#dffaff;font:700 13px monospace;letter-spacing:.1em;margin-bottom:10px";

    const input = document.createElement("input");
    input.id = "cg-admin-input";
    input.type = "text";
    input.autocomplete = "off";
    input.placeholder = "Type command, e.g. boost 8";
    input.style.cssText = [
      "width:100%", "box-sizing:border-box", "padding:11px 12px",
      "border:1px solid rgba(0,220,255,.35)", "border-radius:9px",
      "background:rgba(0,0,0,.35)", "color:#fff", "font:13px monospace",
      "outline:none"
    ].join(";");

    const hint = document.createElement("div");
    hint.textContent = "Enter runs the command. Example: boost 8";
    hint.style.cssText = "color:#8da5b5;font:11px monospace;margin-top:8px";

    panel.append(title, input, hint);
    document.body.append(button, panel);

    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) setTimeout(() => input.focus(), 0);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const command = String(input.value || "").trim();
      if (!command) return;
      input.value = "";
      run(command.replace(/^\/admin\s*/i, ""));
      event.preventDefault();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") panel.hidden = true;
    });
  }

  function init() {
    adminEnabled = isOwner();
    if (!adminEnabled) return;
    window.CubeGameAdmin = { enabled: true, run };
    createAdminPanel();
    output("Owner admin enabled.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
