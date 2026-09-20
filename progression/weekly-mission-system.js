// weekly-mission-system.js
// A second, separate mission track from mission-system.js: instead of
// permanent lifetime goals, this rolls a fresh set of WEEKLY_MISSION_COUNT
// missions every week (random type/target/reward from data/weekly-missions-
// pool.js), tracks progress against stats that reset each week, and grants
// rewards the same way regular missions do. Fully self-contained — owns its
// own slice of state (state.weeklyMissions) and its own stat counters
// (state.weeklyStats), so it never touches mission-system.js's data.
window.WeeklyMissionSystem = (function () {
  const Events = window.ProgressionEvents;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  // Offset so week boundaries land on Monday 00:00 UTC rather than the
  // Unix epoch's Thursday. (Jan 1 1970 was a Thursday; -3 days = Monday.)
  const MONDAY_OFFSET = 3 * 24 * 60 * 60 * 1000;

  let state = null;

  function weekKeyFor(t) {
    return Math.floor((t + MONDAY_OFFSET) / WEEK_MS);
  }
  function weekStart(weekKey) {
    return weekKey * WEEK_MS - MONDAY_OFFSET;
  }
  function currentWeekKey() { return weekKeyFor(Date.now()); }

  function init(sharedState) {
    state = sharedState;
    state.weeklyStats = state.weeklyStats || { gamesPlayed: 0, scoreWeek: 0, bestScoreWeek: 0, chestsOpenedWeek: 0, trophiesWeek: 0 };
    ensureCurrentWeek();

    // Chests are tracked via the shared event bus rather than reaching
    // into chest-system.js directly, so this file stays fully decoupled.
    Events.on("chest:opened", () => {
      state.weeklyStats.chestsOpenedWeek = (state.weeklyStats.chestsOpenedWeek || 0) + 1;
      checkMissions();
      Events.emit("progression:dirty");
    });
    Events.on("trophies:gained", ({ amount }) => {
      state.weeklyStats.trophiesWeek = (state.weeklyStats.trophiesWeek || 0) + (amount || 0);
      checkMissions();
      Events.emit("progression:dirty");
    });
  }

  // Called on every load AND lazily whenever the panel is opened/rendered,
  // so the refresh happens automatically the moment the stored week is
  // stale — no server cron or page-reload timing required.
  function ensureCurrentWeek() {
    const key = currentWeekKey();
    if (state.weeklyMissions && state.weeklyMissions.weekKey === key) return false;
    generateWeek(key);
    return true;
  }

  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generateWeek(weekKey) {
    const pool = (window.WEEKLY_MISSION_POOL || []).slice();
    const count = Math.min(window.WEEKLY_MISSION_COUNT || 4, pool.length);
    // shuffle (Fisher-Yates) then take the first `count` distinct types
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const missions = pool.slice(0, count).map((tmpl, i) => {
      const target = pickRandom(tmpl.targets);
      const rewardId = pickRandom(tmpl.rewards);
      return {
        id: `wm_${weekKey}_${i}_${tmpl.type}`,
        type: tmpl.type,
        target,
        label: tmpl.labelTemplate.replace("{target}", target),
        rewardId
      };
    });

    state.weeklyMissions = { weekKey, missions, claimed: {} };
    state.weeklyStats = { gamesPlayed: 0, scoreWeek: 0, bestScoreWeek: 0, chestsOpenedWeek: 0, trophiesWeek: 0 };
    Events.emit("weeklyMissions:refreshed", state.weeklyMissions);
    Events.emit("progression:dirty");
  }

  function getStat(type) {
    switch (type) {
      case "gamesPlayedWeek":   return state.weeklyStats.gamesPlayed;
      case "scoreWeek":         return state.weeklyStats.scoreWeek;
      case "bestScoreWeek":     return state.weeklyStats.bestScoreWeek;
      case "chestsOpenedWeek":  return state.weeklyStats.chestsOpenedWeek;
      case "trophiesWeek":      return state.weeklyStats.trophiesWeek;
      default:                  return 0;
    }
  }

  function checkMissions() {
    if (!state.weeklyMissions) return [];
    const completed = [];
    state.weeklyMissions.missions.forEach(m => {
      if (state.weeklyMissions.claimed[m.id]) return;
      if (getStat(m.type) >= m.target) {
        state.weeklyMissions.claimed[m.id] = { at: Date.now() };
        completed.push(m);
        Events.emit("weeklyMission:completed", m);
        if (window.RewardSystem) window.RewardSystem.grant(m.rewardId, { source: "weeklyMission", mission: m.id });
      }
    });
    return completed;
  }

  // Call once per match, right when it ends — mirrors mission-system.js.
  function recordMatch(score) {
    if (!state) return;
    ensureCurrentWeek();
    score = score || 0;
    state.weeklyStats.gamesPlayed = (state.weeklyStats.gamesPlayed || 0) + 1;
    state.weeklyStats.scoreWeek = (state.weeklyStats.scoreWeek || 0) + score;
    if (score > (state.weeklyStats.bestScoreWeek || 0)) state.weeklyStats.bestScoreWeek = score;
    checkMissions();
    Events.emit("progression:dirty");
  }

  function getActive() {
    ensureCurrentWeek();
    return state.weeklyMissions;
  }

  function getTimeRemainingMs() {
    const key = currentWeekKey();
    return weekStart(key + 1) - Date.now();
  }

  return { init, recordMatch, checkMissions, getStat, getActive, getTimeRemainingMs, ensureCurrentWeek };
})();
