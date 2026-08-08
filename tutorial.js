// First-run tutorial
// Teaches the core slash loop and grants a one-time progression reward.
(function () {
  "use strict";

  const TUTORIAL_KEY = "tutorial";
  const CUBE_GOAL = 5;
  let state = null;
  let card = null;
  let backdrop = null;
  let hud = null;
  let initialized = false;

  function getTutorialState() {
    if (!state) return null;
    state[TUTORIAL_KEY] = state[TUTORIAL_KEY] || {};
    const tutorial = state[TUTORIAL_KEY];
    tutorial.started = Boolean(tutorial.started);
    tutorial.cubesSmashed = Math.max(0, Number(tutorial.cubesSmashed) || 0);
    tutorial.completed = Boolean(tutorial.completed);
    tutorial.rewardGranted = Boolean(tutorial.rewardGranted);
    return tutorial;
  }

  function save() {
    if (window.ProgressionEvents) window.ProgressionEvents.emit("progression:dirty");
  }

  function build() {
    if (document.getElementById("cg-tutorial-backdrop")) return;

    backdrop = document.createElement("div");
    backdrop.id = "cg-tutorial-backdrop";
    backdrop.className = "cg-tutorial-backdrop";

    card = document.createElement("section");
    card.className = "cg-tutorial-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-labelledby", "cg-tutorial-title");
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    hud = document.createElement("div");
    hud.id = "cg-tutorial-hud";
    hud.className = "cg-tutorial-hud";
    hud.hidden = true;
    document.body.appendChild(hud);

    render();
  }

  function render() {
    const tutorial = getTutorialState();
    if (!tutorial || !card || !backdrop || !hud) return;

    if (tutorial.completed) {
      backdrop.classList.remove("is-visible");
      hud.hidden = true;
      return;
    }

    const started = tutorial.started;
    const smashed = Math.min(CUBE_GOAL, tutorial.cubesSmashed);
    const firstSlashDone = smashed >= 1;
    const goalDone = smashed >= CUBE_GOAL;
    const inGame = typeof window.isInGame === "function" && window.isInGame();

    if (started && inGame) {
      backdrop.classList.remove("is-visible");
      hud.hidden = false;
      hud.innerHTML = `
        <div class="cg-tutorial-hud-title">Tutorial · ${smashed}/${CUBE_GOAL} cubes</div>
        <div class="cg-tutorial-hud-message">${firstSlashDone
          ? `Keep slashing — ${CUBE_GOAL - smashed} more cube${CUBE_GOAL - smashed === 1 ? "" : "s"} to unlock your reward.`
          : "Swipe across the falling cube to make your first slash."}</div>
        <div class="cg-tutorial-hud-progress"><span style="width:${(smashed / CUBE_GOAL) * 100}%"></span></div>
      `;
      return;
    }

    hud.hidden = true;
    backdrop.classList.add("is-visible");
    card.innerHTML = `
      <h2 id="cg-tutorial-title">Cube Training</h2>
      <p class="cg-tutorial-intro">${started
        ? "Pick a game mode, then finish the core training steps. Your progress carries between runs."
        : "Learn the slash, smash a few cubes, and earn a starter reward."}</p>
      <div class="cg-tutorial-steps">
        ${stepMarkup(1, "Start a run", "Choose Normal Mode or Anti Lose Mode.", started)}
        ${stepMarkup(2, "Make your first slash", "Swipe across a falling cube.", firstSlashDone)}
        ${stepMarkup(3, "Smash five cubes", `You have smashed ${smashed} of ${CUBE_GOAL}.`, goalDone)}
      </div>
      <div class="cg-tutorial-reward">
        <span class="cg-tutorial-reward-label">Completion reward</span>
        <span class="cg-tutorial-reward-value">200 COINS</span>
      </div>
      <div class="cg-tutorial-actions">
        <button type="button" class="cg-tutorial-primary" data-tutorial-action="start">${started ? "CONTINUE" : "START TUTORIAL"}</button>
        <button type="button" class="cg-tutorial-secondary" data-tutorial-action="later">LATER</button>
      </div>
    `;

    const startButton = card.querySelector('[data-tutorial-action="start"]');
    const laterButton = card.querySelector('[data-tutorial-action="later"]');
    if (startButton) startButton.addEventListener("click", startTutorial);
    if (laterButton) laterButton.addEventListener("click", () => backdrop.classList.remove("is-visible"));
  }

  function stepMarkup(number, title, detail, complete) {
    return `
      <div class="cg-tutorial-step ${complete ? "is-complete" : number === 1 ? "is-current" : ""}">
        <span class="cg-tutorial-step-marker">${complete ? "✓" : number}</span>
        <span class="cg-tutorial-step-copy"><strong>${title}</strong><span>${detail}</span></span>
      </div>
    `;
  }

  function startTutorial() {
    const tutorial = getTutorialState();
    if (!tutorial) return;
    tutorial.started = true;
    save();
    // Return control to the main menu so the player can choose a mode.
    backdrop.classList.remove("is-visible");
    const normalButton = document.querySelector(".play-normal-btn");
    if (normalButton) normalButton.focus();
  }

  function onModeSelected() {
    const tutorial = getTutorialState();
    if (!tutorial || tutorial.completed) return;
    tutorial.started = true;
    save();
    setTimeout(render, 0);
  }

  function recordCube(amount) {
    const tutorial = getTutorialState();
    if (!tutorial || tutorial.completed || !tutorial.started) return;
    tutorial.cubesSmashed += Math.max(0, Number(amount) || 0);
    save();
    if (tutorial.cubesSmashed >= CUBE_GOAL) {
      complete();
    } else {
      render();
    }
  }

  function complete() {
    const tutorial = getTutorialState();
    if (!tutorial || tutorial.completed) return;
    tutorial.completed = true;
    if (!tutorial.rewardGranted) {
      tutorial.rewardGranted = true;
      if (window.RewardSystem && typeof window.RewardSystem.grant === "function") {
        window.RewardSystem.grant("tutorial_coins", { source: "tutorial" });
      }
    }
    save();
    if (window.RewardSystem && typeof window.RewardSystem.showRewardToast === "function") {
      window.RewardSystem.showRewardToast("Tutorial complete · 200 Coins", "#ffe000");
    }
    showCompletion();
  }

  function showCompletion() {
    if (!card || !backdrop) return;
    hud.hidden = true;
    backdrop.classList.add("is-visible");
    card.innerHTML = `
      <div class="cg-tutorial-complete">
        <h2 id="cg-tutorial-title">Training Complete</h2>
        <p>Nice work. You are ready to play.</p>
        <div class="cg-tutorial-reward">
          <span class="cg-tutorial-reward-value">200 COINS ADDED</span>
        </div>
        <div class="cg-tutorial-actions">
          <button type="button" class="cg-tutorial-primary" data-tutorial-action="close">CONTINUE PLAYING</button>
        </div>
      </div>
    `;
    const closeButton = card.querySelector('[data-tutorial-action="close"]');
    if (closeButton) {
      closeButton.addEventListener("click", () => backdrop.classList.remove("is-visible"));
    }
  }

  function init() {
    if (initialized) return;
    initialized = true;
    state = window.ProgressionManager && window.ProgressionManager.getState
      ? window.ProgressionManager.getState()
      : null;
    if (!state) return;
    build();
    document.addEventListener("click", (event) => {
      if (event.target.closest(".play-normal-btn, .play-casual-btn")) onModeSelected();
    });
    if (window.ProgressionEvents) {
      window.ProgressionEvents.on("progression:ready", () => {
        state = window.ProgressionManager.getState();
        render();
      });
    }
    render();
  }

  window.CGTutorial = { init, recordCube };

  const boot = () => {
    // progression-init runs immediately before this file, but defer one tick
    // so its DOM-ready boot has completed in either loading order.
    setTimeout(init, 0);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();