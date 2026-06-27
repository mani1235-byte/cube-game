// ui/mission-ui.js
// Missions get their own full-screen page (like Brawl Stars' Missions tab)
// rather than a small slide-out panel — opened/closed via the "🎯 Missions"
// toggle button. Shows two sections:
//  - Weekly Missions: a set of WEEKLY_MISSION_COUNT missions that
//    weekly-mission-system.js rerolls automatically every week. A countdown
//    to the next refresh is shown and ticks live while the page is open.
//  - Missions: the original permanent, one-time lifetime missions.
// Each mission is a card showing the actual reward visual (the real chest
// artwork for chest rewards, via CHEST_TABLE[...].image — same images
// connected in chest-ui.js / the Reward Room — or a big icon otherwise).
(function () {
  let toggleBtn, pageEl, contentEl, open = false, tickHandle = null;

  function build() {
    toggleBtn = document.createElement("button");
    toggleBtn.id = "prog-mission-toggle";
    toggleBtn.className = "prog-widget";
    toggleBtn.textContent = "🎯 Missions";
    toggleBtn.addEventListener("click", toggle);
    document.body.appendChild(toggleBtn);

    pageEl = document.createElement("div");
    pageEl.id = "prog-mission-page";
    pageEl.className = "prog-mission-page prog-mission-page-closed";
    pageEl.innerHTML = `
      <div class="prog-mission-page-header">
        <div class="prog-mission-page-title">🎯 Missions</div>
        <button class="prog-mission-page-close" type="button" aria-label="Close">✕</button>
      </div>
      <div class="prog-mission-page-content"></div>`;
    document.body.appendChild(pageEl);
    contentEl = pageEl.querySelector(".prog-mission-page-content");
    pageEl.querySelector(".prog-mission-page-close").addEventListener("click", toggle);

    positionToggle();
    window.addEventListener("resize", positionToggle);

    render();
  }

  // Sits immediately to the right of the main Progress toggle, whatever
  // width that button ends up being (text length varies with locale).
  function positionToggle() {
    const mainToggle = document.getElementById("prog-menu-toggle");
    if (!mainToggle || !toggleBtn) return;
    toggleBtn.style.left = `${mainToggle.getBoundingClientRect().right + 10}px`;
  }

  function toggle() {
    open = !open;
    pageEl.classList.toggle("prog-mission-page-closed", !open);
    pageEl.classList.toggle("prog-mission-page-open", open);
    if (open) {
      render();
      clearInterval(tickHandle);
      tickHandle = setInterval(renderCountdownOnly, 30000);
    } else {
      clearInterval(tickHandle);
    }
  }

  function formatCountdown(ms) {
    if (ms <= 0) return "refreshing…";
    const totalMins = Math.floor(ms / 60000);
    const days = Math.floor(totalMins / (60 * 24));
    const hours = Math.floor((totalMins % (60 * 24)) / 60);
    const mins = totalMins % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  // Cheap update for just the countdown text, called on a timer while the
  // page is open, instead of re-rendering everything every 30s.
  function renderCountdownOnly() {
    const el = contentEl && contentEl.querySelector(".prog-weekly-countdown");
    if (!el || !window.WeeklyMissionSystem) return;
    el.textContent = `Resets in ${formatCountdown(window.WeeklyMissionSystem.getTimeRemainingMs())}`;
  }

  // The big visual on each card: the real chest artwork for chest rewards
  // (same CHEST_TABLE[...].image used in chest-ui.js / the Reward Room),
  // or a large emoji icon for anything else.
  function rewardVisual(reward) {
    if (reward.type === "chest") {
      const chestDef = (window.CHEST_TABLE || {})[reward.chestId];
      if (chestDef && chestDef.image) {
        return `<img class="prog-mission-card-img" src="${chestDef.image}" alt="${chestDef.name}" />`;
      }
    }
    return `<div class="prog-mission-card-icon">${reward.icon || "🎁"}</div>`;
  }

  function missionCard(m, done, current) {
    const reward = (window.REWARD_TABLE || {})[m.rewardId] || { icon: "🎁", label: m.rewardId };
    const pct = Math.round((Math.min(m.target, current) / m.target) * 100);
    return `
      <div class="prog-mission-card ${done ? "prog-mission-card-done" : ""}">
        ${done ? `<div class="prog-mission-card-badge">✅</div>` : ""}
        ${rewardVisual(reward)}
        <div class="prog-mission-card-label">${m.label}</div>
        <div class="prog-mission-card-reward">${reward.label}</div>
        <div class="prog-mission-track"><div class="prog-mission-fill" style="width:${pct}%"></div></div>
        <div class="prog-mission-progress">${Math.min(m.target, current)} / ${m.target}</div>
      </div>`;
  }

  function renderWeeklySection() {
    if (!window.WeeklyMissionSystem) return "";
    const active = window.WeeklyMissionSystem.getActive();
    if (!active) return "";
    const claimed = active.claimed || {};
    const countdown = formatCountdown(window.WeeklyMissionSystem.getTimeRemainingMs());

    return `
      <div class="prog-mission-section-title">
        🗓️ Weekly Missions
        <span class="prog-weekly-countdown">Resets in ${countdown}</span>
      </div>
      <div class="prog-mission-grid">
        ${active.missions.map(m =>
          missionCard(m, !!claimed[m.id], window.WeeklyMissionSystem.getStat(m.type))
        ).join("")}
      </div>`;
  }

  function renderMissionsSection() {
    const state = window.ProgressionManager.getState();
    const claimed = state.missionsClaimed || {};
    const missions = window.MISSIONS || [];
    if (!missions.length) return `<div class="prog-mission-section-title">🎯 Missions</div><span class="prog-empty">No missions yet.</span>`;

    return `
      <div class="prog-mission-section-title">🎯 Missions</div>
      <div class="prog-mission-grid">
        ${missions.map(m =>
          missionCard(m, !!claimed[m.id], window.MissionSystem.getStat(m.type))
        ).join("")}
      </div>`;
  }

  function render() {
    if (!contentEl) return;
    // rolls a fresh weekly set automatically if the stored one is from a
    // past week — no manual refresh needed
    if (window.WeeklyMissionSystem) window.WeeklyMissionSystem.ensureCurrentWeek();
    contentEl.innerHTML = renderWeeklySection() + renderMissionsSection();
  }

  window.MissionUI = { build, render };

  // Deferred one tick so progression-menu.js's "progression:ready" handler
  // (registered after this one, runs synchronously in the same emit pass)
  // has already created #prog-menu-toggle for positionToggle() to measure.
  window.ProgressionEvents.on("progression:ready", () => setTimeout(build, 0));
  window.ProgressionEvents.on("progression:dirty", render);
  window.ProgressionEvents.on("mission:completed", (m) => {
    render();
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🎯", label: `Mission complete: ${m.label}!` });
  });
  window.ProgressionEvents.on("weeklyMission:completed", (m) => {
    render();
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🗓️", label: `Weekly mission complete: ${m.label}!` });
  });
  window.ProgressionEvents.on("weeklyMissions:refreshed", () => {
    render();
    if (window.RewardPopup) window.RewardPopup.show({ icon: "🗓️", label: "New weekly missions are in!" });
  });
})();


