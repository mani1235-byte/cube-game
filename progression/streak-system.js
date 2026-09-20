// streak-system.js
// Daily login streak: checking in unlocks a day, it doesn't grant anything
// by itself. The player has to actually CLAIM the reward (from the streak
// modal). Any unlocked day that hasn't been claimed yet just stacks up —
// check in three days in a row without opening the reward screen, and
// claiming later still gives you all three. Only a broken streak (missing a
// full day) clears the backlog, since that starts a brand new cycle.
//
// The streak counter and the claimed watermark are both account-wide, not
// per-device: check-in and claim both round-trip through the Render server
// (/api/streak/checkin, /api/streak/claim), backed by Firestore keyed by
// username — same pattern as the real-money wallet. That's what makes "day
// 4, 2 unclaimed" mean the same thing on a phone and a laptop, and stops the
// same account double-claiming from two devices. Guests (no account) and
// offline play fall back to a local-only streak so the feature still works,
// it just won't follow them across devices.
//
// Reward tracks change every time a 7-day cycle finishes: cycle 1 uses
// TRACKS[0], cycle 2 uses TRACKS[1], cycle 3 uses TRACKS[2], cycle 4 loops
// back to TRACKS[0], and so on — so it's not the identical seven rewards
// every single week forever.
//
// Coin rewards here are the same casual in-game currency shop.js already
// grants for normal play (CoinSystem.earn via RewardSystem) — not the
// real-money wallet, which stays under its own separate server-verified
// path (PayPal/MetaMask). Nothing about this feature touches that.
window.StreakSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.streak = state.streak || {
      count: 0,          // current consecutive-day streak (1-based, keeps climbing across cycles)
      longest: 0,         // best streak ever
      lastCheckIn: null,  // date of the last successful check-in
      claimedUpTo: 0       // highest streak-count value whose reward has been claimed
    };
  }

  // Three reward tracks that rotate by cycle number, so week 2 and week 3
  // don't hand out the exact same seven things as week 1. All modest early,
  // escalating to the cycle's best reward on day 7.
  const TRACKS = [
    { 1: "coins_small", 2: "coins_medium", 3: "chest_wooden",  4: "coins_large", 5: "chest_silver", 6: "xp_boost_medium", 7: "chest_legendary" },
    { 1: "coins_medium", 2: "coins_small", 3: "xp_boost_medium", 4: "chest_silver", 5: "coins_large", 6: "chest_wooden",   7: "chest_legendary" },
    { 1: "coins_small", 2: "chest_wooden", 3: "coins_medium",  4: "xp_boost_medium", 5: "coins_large", 6: "chest_silver",  7: "chest_legendary" }
  ];

  function rewardForDay(day, cycle) {
    const track = TRACKS[((cycle || 1) - 1) % TRACKS.length];
    const rewardId = track[day] || track[1];
    return { rewardId };
  }

  // Pay coins to skip ahead instead of waiting for the calendar day.
  // 1 day = 50, 2 days = 100, 3 days = 200 — buying further ahead costs
  // more per day since it's worth more (bigger rewards further down track).
  const UNLOCK_COST = { 1: 50, 2: 100, 3: 200 };
  function unlockCost(days) { return UNLOCK_COST[days] || UNLOCK_COST[3]; }

  // ---- local-only fallback (guests / offline) ------------------------------
  function todayKeyLocal(d) {
    d = d || new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function daysBetweenLocal(aKey, bKey) {
    const a = new Date(aKey + "T00:00:00");
    const b = new Date(bKey + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  function localCheckIn() {
    const today = todayKeyLocal();
    const s = state.streak;

    if (s.lastCheckIn === today) {
      return resultFromLocalState(true);
    }

    if (s.lastCheckIn) {
      const gap = daysBetweenLocal(s.lastCheckIn, today);
      if (gap === 1) s.count += 1;
      else if (gap > 1) { s.count = 1; s.claimedUpTo = 0; }
    } else {
      s.count = 1;
    }
    s.lastCheckIn = today;
    s.longest = Math.max(s.longest, s.count);

    return resultFromLocalState(false);
  }

  function resultFromLocalState(alreadyCheckedIn) {
    const s = state.streak;
    const day = ((s.count - 1) % 7) + 1;
    const cycle = Math.floor((s.count - 1) / 7) + 1;
    const pendingCount = Math.max(0, s.count - (s.claimedUpTo || 0));
    return { alreadyCheckedIn, day, cycle, count: s.count, longest: s.longest, lastCheckIn: s.lastCheckIn, pendingCount };
  }

  function localClaim() {
    const s = state.streak;
    const claimed = [];
    for (let n = (s.claimedUpTo || 0) + 1; n <= s.count; n++) {
      claimed.push({ count: n, day: ((n - 1) % 7) + 1, cycle: Math.floor((n - 1) / 7) + 1 });
    }
    s.claimedUpTo = s.count;
    return { claimed, count: s.count, longest: s.longest, claimedUpTo: s.claimedUpTo };
  }

  function localUnlock(days) {
    const s = state.streak;
    s.count += days;
    s.longest = Math.max(s.longest, s.count);
    s.lastCheckIn = todayKeyLocal();
    return resultFromLocalState(false);
  }

  // ---- server-authoritative path --------------------------------------------
  function serverPost(path, username, extra) {
    const base = (window.CUBE_SERVER || window.location.origin || "").replace(/\/$/, "");
    return fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ username }, extra))
    }).then((r) => {
      if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
      return r.json();
    });
  }

  function currentUsername() {
    const user = typeof window.getUser === "function" ? window.getUser() : null;
    return user && !user.isGuest && user.username ? user.username : null;
  }

  // Mirrors a check-in result into local save state (so the track/UI has
  // numbers even offline) and reports it. Does NOT grant anything — that
  // only happens on claim().
  function applyCheckIn(result) {
    const s = state.streak;
    s.count = result.count;
    s.longest = result.longest;
    s.lastCheckIn = result.lastCheckIn;
    if (typeof result.pendingCount === "number") s.claimedUpTo = result.count - result.pendingCount;
    Events.emit("progression:dirty");
    Events.emit("streak:checkin", result);
    return result;
  }

  // Call once on boot. Safe to call more than once per day — cheap no-op
  // after the first check-in "today". Returns a Promise<result>.
  function checkIn() {
    if (!state) return Promise.resolve(null);
    const username = currentUsername();

    if (!username || typeof fetch !== "function") {
      return Promise.resolve(applyCheckIn(localCheckIn()));
    }

    return serverPost("/api/streak/checkin", username)
      .then(applyCheckIn)
      .catch((err) => {
        console.warn("[StreakSystem] server check-in unavailable, using local fallback:", err.message);
        return applyCheckIn(localCheckIn());
      });
  }

  // Grants every unlocked-but-unclaimed day at once. Call this from the
  // "Claim" button in the streak modal. Returns a Promise<{ claimed, ... }>.
  function claim() {
    if (!state) return Promise.resolve({ claimed: [] });
    const username = currentUsername();

    const finish = (result) => {
      const s = state.streak;
      s.count = result.count;
      s.longest = result.longest;
      s.claimedUpTo = result.claimedUpTo;
      Events.emit("progression:dirty");

      result.claimed.forEach(({ day, cycle, count }) => {
        const reward = rewardForDay(day, cycle);
        if (window.XPSystem && window.ProgressionConfig.xp.dailyLoginBonus) {
          window.XPSystem.add(window.ProgressionConfig.xp.dailyLoginBonus, "daily_streak");
        }
        if (window.RewardSystem) {
          window.RewardSystem.grant(reward.rewardId, { source: "streak", day, cycle, count });
        }
      });

      Events.emit("streak:claimed", result);
      return result;
    };

    if (!username || typeof fetch !== "function") {
      return Promise.resolve(finish(localClaim()));
    }

    return serverPost("/api/streak/claim", username)
      .then(finish)
      .catch((err) => {
        console.warn("[StreakSystem] server claim unavailable, using local fallback:", err.message);
        return finish(localClaim());
      });
  }

  // Spend coins to skip ahead `days` (1-3) instead of waiting for the
  // calendar. Deducts coins immediately via CoinSystem (existing, already
  // wired to shop.js's balance) — if that fails (not enough coins), nothing
  // else happens. On success, advances the streak the same way check-in
  // would, so the newly-unlocked day(s) show up as pending and can be
  // claimed normally. Returns a Promise<result|null> (null = couldn't afford it).
  function unlock(days) {
    if (!state) return Promise.resolve(null);
    days = Math.max(1, Math.min(3, Math.trunc(days) || 1));
    const cost = unlockCost(days);

    if (!window.CoinSystem || !window.CoinSystem.spend(cost)) {
      Events.emit("streak:unlock_failed", { days, cost });
      return Promise.resolve(null);
    }

    const username = currentUsername();
    const applyUnlock = (result) => {
      const s = state.streak;
      s.count = result.count;
      s.longest = result.longest;
      s.lastCheckIn = result.lastCheckIn;
      if (typeof result.pendingCount === "number") s.claimedUpTo = result.count - result.pendingCount;
      Events.emit("progression:dirty");
      Events.emit("streak:unlocked", { days, cost, result });
      return result;
    };

    if (!username || typeof fetch !== "function") {
      return Promise.resolve(applyUnlock(localUnlock(days)));
    }

    return serverPost("/api/streak/unlock", username, { days })
      .then(applyUnlock)
      .catch((err) => {
        console.warn("[StreakSystem] server unlock unavailable, using local fallback:", err.message);
        return applyUnlock(localUnlock(days));
      });
  }

  function getState() {
    if (!state) return { count: 0, longest: 0, lastCheckIn: null, claimedUpTo: 0 };
    return state.streak;
  }

  return { init, checkIn, claim, unlock, unlockCost, getState, rewardForDay };
})();
