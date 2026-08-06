// tutorial-system.js
// First-time-player flow. Triggered right after login.js's platform choice
// (btnPlayWeb → enterGame() sets sessionStorage "cg_just_logged_in") lands
// the player back on index.html. Offers a 60-second guided tutorial with a
// single quest ("slice N cubes"); completing the quest grants a reward via
// RewardSystem. Never nags a player twice — state.tutorial.completed is
// persisted in the shared progression save.
//
// Hooks into the existing game loop the same way battle-mode.js does:
// monkeypatching the handful of window-level functions script.js exposes
// (resetGame, incrementCubeCount, endGame) rather than modifying script.js.
window.TutorialSystem = (function () {
  const Events = window.ProgressionEvents;
  const QUEST_TARGET   = 15;      // cubes to slice
  const DURATION_MS    = 60000;   // 1 minute
  const TIP_INTERVAL_MS = 12000;

  const TIPS = [
    "Slice cubes to score points!",
    "Watch out for bombs — they cost you a heart!",
    "Chain quick slices for a combo bonus!",
    "Open the Missions tab any time for bonus rewards!",
    "Check the Shop for skins and power-ups!",
  ];

  let state = null;
  let armed = false;     // welcome prompt should show
  let active = false;    // quest currently running
  let sliced = 0;
  let timeLeft = DURATION_MS;
  let tickHandle = null;
  let tipHandle = null;
  let tipIndex = 0;

  let els = {};
  let origResetGame, origIncrementCubeCount, origEndGame;

  // ── Per-account completion tracking ───────────────────────────────────
  // Deliberately NOT stored in the shared progression save (cg_progression_v1)
  // — that save is one file per browser, shared by every account signed in
  // on it (email, Google, guest). Keying completion off the actual signed-in
  // identity means email/Google/guest each get their own tutorial the first
  // time THEY log in, instead of one account's completion hiding it for all.
  function currentUserKey() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}
    if (!user) return "anon";
    if (user.uid)   return "uid:" + user.uid;
    if (user.email) return "email:" + user.email.toLowerCase();
    if (user.username) return "guest:" + user.username.toLowerCase();
    return "anon";
  }
  function tutorialDoneKey()    { return "cg_tutorial_done:" + currentUserKey(); }
  function tutorialPendingKey() { return "cg_tutorial_pending:" + currentUserKey(); }
  function isTutorialDone()     { return localStorage.getItem(tutorialDoneKey()) === "1"; }
  function isTutorialPending()  { return localStorage.getItem(tutorialPendingKey()) === "1"; }
  function markTutorialDone()   {
    try {
      localStorage.setItem(tutorialDoneKey(), "1");
      localStorage.removeItem(tutorialPendingKey());
    } catch (_) {}
  }
  function markTutorialPending() { try { localStorage.setItem(tutorialPendingKey(), "1"); } catch (_) {} }

  function init() {
    state = window.ProgressionManager.getState();

    const justLoggedIn = sessionStorage.getItem("cg_just_logged_in") === "1";
    sessionStorage.removeItem("cg_just_logged_in");

    if (isTutorialDone()) return;

    // Show the welcome prompt if this is the moment right after login, OR
    // if a tutorial was already started/offered earlier (pending) and the
    // player refreshed or closed the tab before finishing it — localStorage
    // survives both, so it picks back up on the very next page load instead
    // of needing another login to reappear.
    if (justLoggedIn || isTutorialPending()) {
      markTutorialPending();
      armed = true;
      patchGameHooks();
      showWelcomePrompt();
    }
  }

  // ── Monkeypatch the game's own functions to observe progress ─────────────
  function patchGameHooks() {
    if (origResetGame) return; // already patched

    origResetGame = window.resetGame;
    window.resetGame = function (...args) {
      const r = origResetGame.apply(this, args);
      if (armed && !active) startQuest();
      return r;
    };

    origIncrementCubeCount = window.incrementCubeCount;
    window.incrementCubeCount = function (inc, ...rest) {
      const r = origIncrementCubeCount.apply(this, [inc, ...rest]);
      if (active && inc > 0) onCubesSliced(inc);
      return r;
    };

    origEndGame = window.endGame;
    window.endGame = function (...args) {
      const r = origEndGame.apply(this, args);
      if (active) onGameEnded();
      return r;
    };
  }

  function unpatchGameHooks() {
    if (origResetGame)          window.resetGame = origResetGame;
    if (origIncrementCubeCount) window.incrementCubeCount = origIncrementCubeCount;
    if (origEndGame)             window.endGame = origEndGame;
    origResetGame = origIncrementCubeCount = origEndGame = null;
  }

  // ── Welcome prompt ─────────────────────────────────────────────────────
  function showWelcomePrompt() {
    const overlay = document.createElement("div");
    overlay.id = "tut-welcome";
    overlay.className = "tut-overlay";
    overlay.innerHTML = `
      <div class="tut-card">
        <div class="tut-card-icon">🎓</div>
        <div class="tut-card-title">New Here?</div>
        <div class="tut-card-body">Take a quick 60-second tutorial and slice
          ${QUEST_TARGET} cubes to earn coins, XP, and a free chest.</div>
        <div class="tut-card-actions">
          <button type="button" class="tut-btn tut-btn-primary" id="tutStartBtn">Start Tutorial</button>
          <button type="button" class="tut-btn tut-btn-ghost" id="tutSkipBtn">Skip</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("tut-open"));

    document.getElementById("tutStartBtn").addEventListener("click", () => {
      closeWelcomePrompt();
      const btn = document.querySelector(".play-casual-btn"); // anti-lose mode — no heart loss while learning
      if (btn) btn.click();
      else startQuest(); // fallback if menu markup ever changes
    });
    document.getElementById("tutSkipBtn").addEventListener("click", () => {
      closeWelcomePrompt();
      armed = false;
      markCompleted({ skipped: true });
    });
  }

  function closeWelcomePrompt() {
    const el = document.getElementById("tut-welcome");
    if (!el) return;
    el.classList.remove("tut-open");
    setTimeout(() => el.remove(), 250);
  }

  // ── Quest lifecycle ────────────────────────────────────────────────────
  function startQuest() {
    if (active) return;
    armed = false;
    active = true;
    sliced = 0;
    timeLeft = DURATION_MS;
    buildQuestHud();
    tipIndex = 0;
    setTip(TIPS[0]);
    tipHandle = setInterval(() => {
      tipIndex = (tipIndex + 1) % TIPS.length;
      setTip(TIPS[tipIndex]);
    }, TIP_INTERVAL_MS);
    tickHandle = setInterval(tick, 1000);
  }

  function tick() {
    timeLeft -= 1000;
    updateHud();
    if (timeLeft <= 0) endQuest({ success: false });
  }

  function onCubesSliced(inc) {
    sliced = Math.min(QUEST_TARGET, sliced + inc);
    updateHud();
    if (sliced >= QUEST_TARGET) endQuest({ success: true });
  }

  function onGameEnded() {
    // Died mid-tutorial (rare in anti-lose mode) — end gracefully, no reward,
    // but don't mark completed so the prompt can offer it again next login.
    endQuest({ success: false, interrupted: true });
  }

  function endQuest({ success, interrupted } = {}) {
    if (!active) return;
    active = false;
    clearInterval(tickHandle);
    clearInterval(tipHandle);
    tickHandle = tipHandle = null;
    removeQuestHud();
    unpatchGameHooks();

    if (success) {
      window.RewardSystem.grant("tutorial_coins", { source: "tutorial" });
      window.RewardSystem.grant("tutorial_xp",    { source: "tutorial" });
      window.RewardSystem.grant("tutorial_chest", { source: "tutorial" });
      markCompleted({ skipped: false });
      showCompletionModal();
    } else if (!interrupted) {
      // Ran out of time without finishing — don't punish, just let them try
      // again next time they log in (tutorial.completed stays false).
      window.RewardSystem.showRewardToast("Tutorial ended — keep playing to earn it next time!", "#9aa0ff");
    }
  }

  function markCompleted({ skipped }) {
    markTutorialDone();
  }

  // ── HUD ────────────────────────────────────────────────────────────────
  function buildQuestHud() {
    const hud = document.createElement("div");
    hud.id = "tut-quest-hud";
    hud.className = "prog-widget tut-quest-hud";
    hud.innerHTML = `
      <div class="tut-quest-row">
        <span class="tut-quest-label">🎯 Slice ${QUEST_TARGET} cubes</span>
        <span class="tut-quest-timer" id="tutTimer">1:00</span>
      </div>
      <div class="tut-quest-track"><div class="tut-quest-fill" id="tutFill"></div></div>
      <div class="tut-quest-count" id="tutCount">0 / ${QUEST_TARGET}</div>
      <div class="tut-quest-tip" id="tutTip"></div>`;
    document.body.appendChild(hud);
    els.hud = hud;
    els.timer = hud.querySelector("#tutTimer");
    els.fill  = hud.querySelector("#tutFill");
    els.count = hud.querySelector("#tutCount");
    els.tip   = hud.querySelector("#tutTip");
    requestAnimationFrame(() => hud.classList.add("tut-open"));
    updateHud();
  }

  function removeQuestHud() {
    if (!els.hud) return;
    els.hud.classList.remove("tut-open");
    setTimeout(() => els.hud && els.hud.remove(), 250);
    els = {};
  }

  function updateHud() {
    if (!els.hud) return;
    const secs = Math.max(0, Math.ceil(timeLeft / 1000));
    els.timer.textContent = `0:${String(secs).padStart(2, "0")}`;
    els.fill.style.width = `${Math.min(100, (sliced / QUEST_TARGET) * 100)}%`;
    els.count.textContent = `${sliced} / ${QUEST_TARGET}`;
  }

  function setTip(text) {
    if (els.tip) els.tip.textContent = "💡 " + text;
  }

  function showCompletionModal() {
    const overlay = document.createElement("div");
    overlay.id = "tut-complete";
    overlay.className = "tut-overlay";
    overlay.innerHTML = `
      <div class="tut-card">
        <div class="tut-card-icon">🎉</div>
        <div class="tut-card-title">Tutorial Complete!</div>
        <div class="tut-card-body">You earned 300 Coins, +150 XP, and a Wooden Chest.</div>
        <div class="tut-card-actions">
          <button type="button" class="tut-btn tut-btn-primary" id="tutDoneBtn">Nice!</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("tut-open"));
    document.getElementById("tutDoneBtn").addEventListener("click", () => {
      overlay.classList.remove("tut-open");
      setTimeout(() => overlay.remove(), 250);
    });
  }

  Events.on("progression:ready", init);

  return { getState: () => state };
})();
