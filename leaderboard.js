// leaderboard.js
// Global leaderboard: reports each run's score to the server (see
// server.js's /api/leaderboard/submit, which only ever raises a player's
// stored best) and renders the top scores in the #leaderboardOverlay modal
// defined in index.html. Works the same for guests, Google-signed-in, and
// registered players — they're all just a "username" string as far as the
// server is concerned (see server.js's isValidName, which accepts any
// script's letters/numbers so Google display names with accents etc. don't
// get silently rejected).
window.CGLeaderboard = (function () {
  const listEl    = () => document.getElementById('leaderboardList');
  const overlayEl = () => document.getElementById('leaderboardOverlay');

  function base() {
    return (window.CUBE_SERVER || window.location.origin || '').replace(/\/$/, '');
  }

  // Reports a run's score at game-over (see server.js's /api/leaderboard/submit,
  // which only ever raises the player's stored best — never lowers it).
  // Returns a promise resolving to { updated, best, rank, totalPlayers },
  // or null if the report failed (offline, rate-limited, invalid name, etc)
  // — the caller should treat null as "couldn't get a rank right now" and
  // just hide the rank UI rather than error out.
  async function submitScore(username, score) {
    try {
      if (!username || typeof score !== 'number' || !Number.isFinite(score) || score <= 0) return null;
      const res = await fetch(`${base()}/api/leaderboard/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, score: Math.floor(score) }),
        keepalive: true,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        console.warn('[leaderboard] submit rejected:', res.status, body && body.error);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn('[leaderboard] submit failed:', e.message);
      return null;
    }
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

  // Standalone rank lookup — used for the "your rank" footer row when the
  // current player isn't in the visible top list at all.
  async function fetchRank(username) {
    try {
      const res = await fetch(`${base()}/api/leaderboard/rank/${encodeURIComponent(username)}`);
      if (!res.ok) return null;
      return await res.json(); // { username, best, rank, totalPlayers }
    } catch (_) {
      return null;
    }
  }

  function currentUsername() {
    try {
      const user = JSON.parse(localStorage.getItem('cg_current_user'));
      return user ? user.username : null;
    } catch (_) { return null; }
  }

  function medal(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  function nameSafe(name) {
    return String(name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function rowHTML(rank, username, score, isYou) {
    return `
      <div class="lb-row${isYou ? ' lb-you' : ''}${rank <= 3 ? ' lb-top' : ''}">
        <div class="lb-rank">${medal(rank)}</div>
        <div class="lb-name">${nameSafe(username)}${isYou ? ' <span class="lb-you-tag">YOU</span>' : ''}</div>
        <div class="lb-score">${(score || 0).toLocaleString()}</div>
      </div>`;
  }

  async function render(entries) {
    const el = listEl();
    if (!el) return;
    if (!entries.length) {
      el.innerHTML = `<div class="lb-empty">No scores yet — be the first on the board!</div>`;
      return;
    }
    const me = currentUsername();
    const meInList = me && entries.some((row) => row.username === me);

    el.innerHTML = entries
      .map((row, i) => rowHTML(i + 1, row.username, row.score, !!(me && row.username === me)))
      .join('');

    // If the current player has a saved score but isn't visible in the top
    // list, pin their real rank at the bottom so everyone can see where
    // they stand, not just people near the top.
    if (me && !meInList) {
      const info = await fetchRank(me);
      if (info && info.best > 0) {
        el.insertAdjacentHTML(
          'beforeend',
          `<div class="lb-row-divider"></div>${rowHTML(info.rank, me, info.best, true)}`
        );
      }
    }
  }

  async function refresh() {
    const el = listEl();
    if (el) el.innerHTML = `<div class="lb-loading">Loading leaderboard…</div>`;
    try {
      const entries = await fetchTop(50);
      await render(entries);
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

  return { submitScore, renderRankLabel, fetchRank, open, close, refresh };
})();
