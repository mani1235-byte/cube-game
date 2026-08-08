// leaderboard.js
// Global leaderboard: reports each run's score to the server (see
// server.js's /api/leaderboard/submit, which only ever raises a player's
// stored best) and renders the top scores in the #leaderboardOverlay modal
// defined in index.html. Mirrors the fetch/base-URL pattern already used by
// shop.js and progression/coin-system.js.
window.CGLeaderboard = (function () {
  const listEl    = () => document.getElementById('leaderboardList');
  const overlayEl = () => document.getElementById('leaderboardOverlay');
  // Small, achievable weekly-style placement rewards. A player can claim a
  // given placement once on this device; improving their placement can earn
  // the higher placement's reward too.
  const RANK_REWARDS = Object.freeze({
    1: 100,
    2: 90,
    3: 80,
    4: 70,
    5: 60,
    6: 50,
    7: 40,
    8: 30,
    9: 20,
    10: 10,
  });
  const CLAIMS_KEY = 'cg_leaderboard_rewards_v1';

  function base() {
    return (window.CUBE_SERVER || window.location.origin || '').replace(/\/$/, '');
  }

  // Reports a run's score at game-over (see server.js's /api/leaderboard/submit,
  // which only ever raises the player's stored best — never lowers it).
  // Returns a promise resolving to { updated, best, rank, totalPlayers },
  // or null if the report failed (offline, rate-limited, guest, etc) — the
  // caller should treat null as "couldn't get a rank right now" and just
  // hide the rank UI rather than error out.
  async function submitScore(username, score) {
    try {
      if (!username || typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
      const res = await fetch(`${base()}/api/leaderboard/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score: Math.floor(score) }),
        keepalive: true,
      });
      if (!res.ok) return null;
      const info = await res.json();
      if (info && info.rank) claimRankReward(info.rank);
      return info;
    } catch (_) {
      return null;
    }
  }

  function getClaims() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLAIMS_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function claimRankReward(rank) {
    const reward = RANK_REWARDS[Number(rank)];
    if (!reward) return;

    const claims = getClaims();
    const claimKey = String(rank);
    if (claims[claimKey]) return;

    claims[claimKey] = Date.now();
    try {
      localStorage.setItem(CLAIMS_KEY, JSON.stringify(claims));
    } catch (_) {}

    // Use the same progression coin path as missions and tutorial rewards.
    // It updates the visible wallet and reports the earning to the server
    // when the player has an account.
    if (window.CoinSystem && typeof window.CoinSystem.earn === 'function') {
      window.CoinSystem.earn(reward, `reward:leaderboard_rank_${rank}`);
    } else if (typeof window.grantCoins === 'function') {
      window.grantCoins(reward);
    }

    const label = `Leaderboard #${rank} reward · +${reward} coins`;
    if (window.RewardSystem && typeof window.RewardSystem.showRewardToast === 'function') {
      window.RewardSystem.showRewardToast(label, '#ffe000');
    }
  }

  function rewardForRank(rank) {
    return RANK_REWARDS[Number(rank)] || 0;
  }

  // Renders "Rank #N of M" (or "New best! Rank #N of M" when this run
  // raised the stored score) into the given element. Safe to call with a
  // null info (e.g. guest players, or a failed report) — just clears it.
  function renderRankLabel(el, info) {
    if (!el) return;
    if (!info || !info.rank) { el.textContent = ''; return; }
    const prefix = info.updated ? '🏆 New best! ' : '';
    el.textContent = `${prefix}Rank #${info.rank.toLocaleString()} of ${info.totalPlayers.toLocaleString()}`;
  }

  async function fetchTop(limit = 50) {
    const res = await fetch(`${base()}/api/leaderboard?limit=${encodeURIComponent(limit)}`);
    if (!res.ok) throw new Error('leaderboard fetch failed');
    const data = await res.json();
    return Array.isArray(data.leaderboard) ? data.leaderboard : [];
  }

  function currentUsername() {
    try {
      const user = JSON.parse(localStorage.getItem('cg_current_user'));
      return user && !user.isGuest ? user.username : null;
    } catch (_) { return null; }
  }

  function medal(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  function render(entries) {
    const el = listEl();
    if (!el) return;
    if (!entries.length) {
      el.innerHTML = `<div class="lb-empty">No scores yet — be the first on the board!</div>`;
      return;
    }
    const me = currentUsername();
    el.innerHTML = entries.map((row, i) => {
      const rank = i + 1;
      const isYou = me && row.username === me;
      const nameSafe = String(row.username || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const reward = rewardForRank(rank);
      return `
        <div class="lb-row${isYou ? ' lb-you' : ''}${rank <= 10 ? ' lb-top' : ''}">
          <div class="lb-rank">${medal(rank)}</div>
          <div class="lb-name">${nameSafe}${isYou ? ' <span class="lb-you-tag">YOU</span>' : ''}</div>
          <div class="lb-score">${(row.score || 0).toLocaleString()}</div>
          ${reward ? `<div class="lb-reward">+${reward} 🪙</div>` : ''}
        </div>`;
    }).join('');
  }

  async function refresh() {
    const el = listEl();
    if (el) el.innerHTML = `<div class="lb-loading">Loading leaderboard…</div>`;
    try {
      const entries = await fetchTop(50);
      render(entries);
    } catch (e) {
      if (el) el.innerHTML = `<div class="lb-empty">Couldn't load the leaderboard. Try again in a moment.</div>`;
    }
  }

  function open() {
    const overlay = overlayEl();
    if (!overlay) return;
    overlay.classList.add('open');
    refresh();
  }

  function close() {
    const overlay = overlayEl();
    if (overlay) overlay.classList.remove('open');
  }

  function initUI() {
    const overlay = overlayEl();
    if (overlay) {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }
    document.querySelectorAll('[data-open-leaderboard]').forEach((btn) => {
      btn.addEventListener('click', open);
    });
    document.querySelectorAll('[data-close-leaderboard]').forEach((btn) => {
      btn.addEventListener('click', close);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  return { submitScore, renderRankLabel, open, close, refresh, rewardForRank };
})();
