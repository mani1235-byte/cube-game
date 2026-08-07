// tutorial-system.js
// A real guided, step-by-step first-time tutorial (not just a passive HUD).
// Each step spotlights a real piece of the UI and either times out or waits
// for the player to actually do the thing (slice N cubes) before advancing.
// Triggers on index.html for any signed-in account (email, Google, guest)
// that hasn't finished it yet — checked directly against that account's own
// id, independent of any flag set by login.js/firebase-auth.js.
window.TutorialSystem = (function () {
  const QUEST_TARGET    = 15;     // total cubes to slice by the end
  const STEP2_TARGET    = 5;      // cubes to slice mid-tutorial (step "practice slice")
  const OVERALL_LIMIT_MS = 60000; // hard 1-minute ceiling for the whole thing

  let userState = { sliced: 0 };
  let overallTimeLeft = OVERALL_LIMIT_MS;
  let overallTickHandle = null;
  let overallTimerEl = null;

  let stepIndex = -1;
  let stepTimeoutHandle = null;
  let resizeHandle = null;
  let running = false;

  let origResetGame, origIncrementCubeCount, origEndGame;
  let usedSafetyNet = false;   // becomes true once we've already offered anti-lose mode
  let awaitingModeClick = false; // true while spotlighting a mode button, waiting for the player to click it
  let resumeStepIndex = null;  // step to return to after an anti-lose mode-switch prompt
  let timerStarted = false;

  // ── Per-account completion tracking (localStorage, not the shared save) ──
  function currentUserKey() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}
    if (!user) return "anon";
    if (user.uid)       return "uid:" + user.uid;
    if (user.email)     return "email:" + user.email.toLowerCase();
    if (user.username)  return "guest:" + user.username.toLowerCase();
    return "anon";
  }
  function doneKey()    { return "cg_tutorial_done:" + currentUserKey(); }
  function isDone()     { return localStorage.getItem(doneKey()) === "1"; }
  function markDone()   { try { localStorage.setItem(doneKey(), "1"); } catch (_) {} }

  function init() {
    console.log("[TutorialSystem] user=" + currentUserKey() + " done=" + isDone());
    if (isDone()) return;
    showWelcomePrompt();
  }

  // ── Game hooks (same monkeypatch pattern as battle-mode.js) ─────────────
  function patchGameHooks() {
    if (origResetGame) return;
    origResetGame = window.resetGame;
    window.resetGame = function (...args) {
      const r = origResetGame.apply(this, args);
      if (running && awaitingModeClick) {
        awaitingModeClick = false;
        if (!timerStarted) { timerStarted = true; startOverallTimer(); }
        if (resumeStepIndex !== null) {
          const idx = resumeStepIndex;
          resumeStepIndex = null;
          renderStep(STEPS[idx]); // pick the interrupted step back up, progress intact
        } else {
          nextStep(); // first mode click → move into step 0
        }
      }
      return r;
    };
    origIncrementCubeCount = window.incrementCubeCount;
    window.incrementCubeCount = function (inc, ...rest) {
      const r = origIncrementCubeCount.apply(this, [inc, ...rest]);
      if (running && inc > 0) onCubeSliced(inc);
      return r;
    };
    origEndGame = window.endGame;
    window.endGame = function (...args) {
      const r = origEndGame.apply(this, args);
      if (running) handleGameOver();
      return r;
    };
  }
  function unpatchGameHooks() {
    if (origResetGame)          window.resetGame = origResetGame;
    if (origIncrementCubeCount) window.incrementCubeCount = origIncrementCubeCount;
    if (origEndGame)             window.endGame = origEndGame;
    origResetGame = origIncrementCubeCount = origEndGame = null;
  }

  // ── Welcome card ──────────────────────────────────────────────────────
  function showWelcomePrompt() {
    const overlay = document.createElement("div");
    overlay.id = "tut-welcome";
    overlay.className = "tut-overlay";
    overlay.innerHTML = `
      <div class="tut-card">
        <div class="tut-card-icon">🎓</div>
        <div class="tut-card-title">New Here?</div>
        <div class="tut-card-body">Take a quick guided tour of the game — slice
          ${QUEST_TARGET} cubes along the way to earn coins, XP, and a free chest.</div>
        <div class="tut-card-actions">
          <button type="button" class="tut-btn tut-btn-primary" id="tutStartBtn">Start Tutorial</button>
          <button type="button" class="tut-btn tut-btn-ghost" id="tutSkipBtn">Skip</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("tut-open"));

    document.getElementById("tutStartBtn").addEventListener("click", () => {
      closeOverlay(overlay);
      patchGameHooks();
      beginTutorial();
    });
    document.getElementById("tutSkipBtn").addEventListener("click", () => {
      closeOverlay(overlay);
      markDone();
    });
  }

  function closeOverlay(el) {
    el.classList.remove("tut-open");
    setTimeout(() => el.remove(), 250);
  }

  // ── Step engine ───────────────────────────────────────────────────────
  // mode: "timed"  → auto-advance after ms
  // mode: "action" → advance once userState.sliced >= target_count
  const STEPS = [
    { text: "Your cube moves with the mouse / touch — steer it to line up your slices.",
      target: "#c", mode: "timed", ms: 4200 },
    { text: `Slice the flying cubes to score points! Get ${STEP2_TARGET} to continue.`,
      target: "#c", mode: "action", target_count: STEP2_TARGET },
    { text: "Red bombs cost you a heart — dodge them, don't slice them!",
      target: "#c", mode: "timed", ms: 4200 },
    { text: "This is your score and cube count.",
      target: ".hud__score", mode: "timed", ms: 3200 },
    { text: "Open the Shop any time to grab skins and power-ups.",
      target: ".shop-btn", mode: "timed", ms: 3200 },
    { text: `Now finish strong — slice ${QUEST_TARGET} total to complete the tutorial!`,
      target: "#c", mode: "action", target_count: QUEST_TARGET },
  ];

  function beginTutorial() {
    running = true;
    usedSafetyNet = false;
    timerStarted = false;
    userState.sliced = 0;
    overallTimeLeft = OVERALL_LIMIT_MS;
    stepIndex = -1;
    buildChrome();
    // Tell them, don't do it for them: spotlight the real "Normal mod"
    // button on the main menu and wait for them to click it. If they later
    // game-over before finishing, handleGameOver() spotlights "Anti lose
    // mod" the same way instead of switching modes automatically.
    showModeSelectStep(".play-normal-btn",
      `Click "Normal mod" below to start your first match!`);
  }

  function showModeSelectStep(target, text) {
    clearTimeout(stepTimeoutHandle);
    awaitingModeClick = true;
    positionSpotlight(target);
    window.removeEventListener("resize", resizeHandle);
    resizeHandle = () => positionSpotlight(target);
    window.addEventListener("resize", resizeHandle);
    document.getElementById("tutTipText").textContent = text;
    document.getElementById("tutTipProgress").textContent = "";
  }

  function buildChrome() {
    const chrome = document.createElement("div");
    chrome.id = "tut-chrome";
    chrome.innerHTML = `
      <div class="tut-spot-box" id="tutSpotBox"></div>
      <div class="tut-tip" id="tutTip">
        <div class="tut-tip-timer" id="tutTipTimer"></div>
        <div class="tut-tip-text" id="tutTipText"></div>
        <div class="tut-tip-progress" id="tutTipProgress"></div>
      </div>`;
    document.body.appendChild(chrome);
    overallTimerEl = document.getElementById("tutTipTimer");
    requestAnimationFrame(() => chrome.classList.add("tut-open"));
  }

  function removeChrome() {
    const chrome = document.getElementById("tut-chrome");
    if (!chrome) return;
    chrome.classList.remove("tut-open");
    setTimeout(() => chrome.remove(), 250);
  }

  function nextStep() {
    clearTimeout(stepTimeoutHandle);
    stepIndex += 1;
    if (stepIndex >= STEPS.length) {
      stopTutorial({ success: true });
      return;
    }
    renderStep(STEPS[stepIndex]);
  }

  function renderStep(step) {
    positionSpotlight(step.target);
    window.removeEventListener("resize", resizeHandle);
    resizeHandle = () => positionSpotlight(step.target);
    window.addEventListener("resize", resizeHandle);

    document.getElementById("tutTipText").textContent = step.text;
    const progressEl = document.getElementById("tutTipProgress");

    if (step.mode === "timed") {
      progressEl.textContent = "";
      stepTimeoutHandle = setTimeout(nextStep, step.ms);
    } else {
      updateActionProgress(step);
    }
  }

  function updateActionProgress(step) {
    if (!running || stepIndex < 0 || STEPS[stepIndex] !== step) return;
    const progressEl = document.getElementById("tutTipProgress");
    if (progressEl) progressEl.textContent = `${userState.sliced} / ${step.target_count}`;
  }

  function positionSpotlight(selector) {
    const box = document.getElementById("tutSpotBox");
    const tip = document.getElementById("tutTip");
    if (!box || !tip) return;
    const target = selector ? document.querySelector(selector) : null;
    if (!target) {
      box.style.opacity = "0";
      tip.style.top = "auto"; tip.style.bottom = "90px";
      tip.style.left = "50%"; tip.style.transform = "translateX(-50%)";
      return;
    }
    const r = target.getBoundingClientRect();
    const pad = 10;
    box.style.opacity = "1";
    box.style.left   = (r.left - pad) + "px";
    box.style.top    = (r.top - pad) + "px";
    box.style.width  = (r.width + pad * 2) + "px";
    box.style.height = (r.height + pad * 2) + "px";

    const tipTop = r.bottom + 18;
    const spaceBelow = window.innerHeight - r.bottom;
    if (spaceBelow > 140) {
      tip.style.top = tipTop + "px"; tip.style.bottom = "auto";
    } else {
      tip.style.bottom = (window.innerHeight - r.top + 18) + "px"; tip.style.top = "auto";
    }
    tip.style.left = Math.min(Math.max(r.left + r.width / 2, 170), window.innerWidth - 170) + "px";
    tip.style.transform = "translateX(-50%)";
  }

  function onCubeSliced(inc) {
    userState.sliced += inc;
    const step = STEPS[stepIndex];
    if (step && step.mode === "action") {
      updateActionProgress(step);
      if (userState.sliced >= step.target_count) nextStep();
    }
  }

  function startOverallTimer() {
    overallTickHandle = setInterval(() => {
      overallTimeLeft -= 1000;
      const secs = Math.max(0, Math.ceil(overallTimeLeft / 1000));
      if (overallTimerEl) overallTimerEl.textContent = `0:${String(secs).padStart(2, "0")}`;
      if (overallTimeLeft <= 0) stopTutorial({ success: false });
    }, 1000);
  }

  function handleGameOver() {
    if (usedSafetyNet) {
      // Already offered anti-lose once — a second game-over ends the
      // tutorial gracefully rather than looping the prompt forever.
      stopTutorial({ success: false, interrupted: true });
      return;
    }
    usedSafetyNet = true;
    resumeStepIndex = stepIndex; // remember exactly where we were — progress isn't lost
    showModeSelectStep(".play-casual-btn",
      `You ran out of hearts! Click "Anti lose mod" to try again without losing hearts.`);
  }

  function stopTutorial({ success, interrupted } = {}) {
    if (!running) return;
    running = false;
    clearTimeout(stepTimeoutHandle);
    clearInterval(overallTickHandle);
    window.removeEventListener("resize", resizeHandle);
    removeChrome();
    unpatchGameHooks();

    if (success) {
      window.RewardSystem.grant("tutorial_coins", { source: "tutorial" });
      window.RewardSystem.grant("tutorial_xp",    { source: "tutorial" });
      window.RewardSystem.grant("tutorial_chest", { source: "tutorial" });
      markDone();
      showCompletionModal();
    } else if (!interrupted) {
      window.RewardSystem.showRewardToast("Tutorial ended — try again to earn the reward!", "#9aa0ff");
    }
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
    document.getElementById("tutDoneBtn").addEventListener("click", () => closeOverlay(overlay));
  }

  window.ProgressionEvents.on("progression:ready", init);

  return {};
})();
