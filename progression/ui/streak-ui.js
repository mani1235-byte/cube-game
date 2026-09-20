// ui/streak-ui.js
// Shows the "Daily Reward" modal on check-in whenever there's at least one
// unclaimed day waiting. The track shows all 7 days for the CURRENT cycle:
// claimed days are greyed out, unlocked-but-unclaimed days are lit up and
// covered by the Claim button, and days still in the future show a small
// coin-cost badge — click one to instantly unlock it (and everything before
// it) by spending coins, no waiting for the calendar.
window.StreakUI = (function () {
  const ICONS = { 1: "🪙", 2: "🪙", 3: "📦", 4: "🪙", 5: "🎁", 6: "✨", 7: "👑" };
  const LABELS = {
    coins_small: "50 Coins", coins_medium: "200 Coins", coins_large: "750 Coins",
    chest_wooden: "Wooden Chest", chest_silver: "Silver Chest", chest_legendary: "Legendary Chest",
    xp_boost_medium: "+300 XP"
  };

  function buildTrack(cycle, count, claimedUpTo) {
    let html = "";
    for (let d = 1; d <= 7; d++) {
      const reward = window.StreakSystem.rewardForDay(d, cycle);
      const label = LABELS[reward.rewardId] || reward.rewardId;
      const absoluteCount = (cycle - 1) * 7 + d;
      const daysAhead = absoluteCount - count; // <=0 already unlocked, >0 still locked

      let cls, footer;
      if (absoluteCount <= claimedUpTo) {
        cls = "prog-streak-day prog-streak-day-done";
        footer = "";
      } else if (daysAhead <= 0) {
        cls = "prog-streak-day prog-streak-day-active";
        footer = "";
      } else {
        cls = "prog-streak-day prog-streak-day-locked";
        const cost = window.StreakSystem.unlockCost(Math.min(daysAhead, 3));
        footer = `<div class="prog-streak-day-cost" data-days-ahead="${Math.min(daysAhead, 3)}">🪙 ${cost}</div>`;
      }

      html += `
        <div class="${cls}">
          <div class="prog-streak-day-num">Day ${d}</div>
          <div class="prog-streak-day-icon">${ICONS[d]}</div>
          <div class="prog-streak-day-label">${label}</div>
          ${footer}
        </div>`;
    }
    return html;
  }

  function render(checkInResult, modal) {
    const { day, cycle, count, longest } = checkInResult;
    const s = window.StreakSystem.getState();
    const claimedUpTo = s.claimedUpTo || 0;
    const pendingCount = Math.max(0, count - claimedUpTo);

    modal.querySelector(".prog-streak-title").textContent = `🔥 Daily Streak — Day ${day}`;
    modal.querySelector(".prog-streak-sub").textContent =
      `${count} day${count === 1 ? "" : "s"} in a row${longest > count ? ` · best: ${longest}` : ""}`;
    modal.querySelector(".prog-streak-track").innerHTML = buildTrack(cycle, count, claimedUpTo);

    const claimBtn = modal.querySelector(".prog-streak-claim-btn");
    if (pendingCount > 0) {
      claimBtn.style.display = "";
      claimBtn.disabled = false;
      claimBtn.textContent = pendingCount > 1 ? `Claim All (${pendingCount})` : "Claim";
    } else {
      claimBtn.style.display = "none";
    }
  }

  function show(checkInResult) {
    // Only pop up automatically if there's something new to claim; if the
    // player later unlocks days with coins from elsewhere, that's a direct
    // call to StreakSystem.unlock() and doesn't need this auto-popup.
    if (!checkInResult.pendingCount) return;

    const overlay = document.createElement("div");
    overlay.className = "prog-streak-overlay";
    overlay.innerHTML = `
      <div class="prog-streak-modal">
        <div class="prog-streak-title"></div>
        <div class="prog-streak-sub"></div>
        <div class="prog-streak-track"></div>
        <button class="prog-streak-claim-btn"></button>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("prog-streak-overlay-in"));

    const modal = overlay.querySelector(".prog-streak-modal");
    render(checkInResult, modal);

    function close() {
      overlay.classList.remove("prog-streak-overlay-in");
      setTimeout(() => overlay.remove(), 250);
    }

    modal.querySelector(".prog-streak-claim-btn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Claiming…";
      window.StreakSystem.claim().then(() => {
        render(checkInResult, modal); // re-render in case something's still pending edge case
        close();
      });
    });

    // Clicking a locked day's coin badge unlocks it (and everything before it).
    modal.querySelector(".prog-streak-track").addEventListener("click", (e) => {
      const badge = e.target.closest(".prog-streak-day-cost");
      if (!badge) return;
      const daysAhead = parseInt(badge.dataset.daysAhead, 10);
      badge.textContent = "…";
      window.StreakSystem.unlock(daysAhead).then((result) => {
        if (!result) {
          badge.textContent = "Not enough coins";
          setTimeout(() => render(checkInResult, modal), 1200);
          return;
        }
        render(Object.assign({}, checkInResult, result), modal);
      });
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  }

  window.ProgressionEvents.on("streak:checkin", show);

  return { show };
})();
