// leaderboard.js — CUBE GAME Global Leaderboard
// Saves scores locally now — connects to real backend after firstgame.org launch
// ============================================================================

(function () {
  "use strict";

  const KEYS = {
    scores:      "cg_leaderboard",
    currentUser: "cg_current_user",
  };

  // ── Avatar colors per rank ─────────────────────────────────────────────
  const AVATAR_COLORS = [
    "#67d7f0","#a6e02c","#fa2473","#fe9522","#cc00ff",
    "#ff2200","#00ffcc","#ffdd00","#0088ff","#ff6600",
  ];

  // ── Load all scores ────────────────────────────────────────────────────
  function loadScores() {
    try {
      const raw = localStorage.getItem(KEYS.scores);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  // ── Save a score ───────────────────────────────────────────────────────
  function saveScore(username, score, games, badgeIcon) {
    const scores = loadScores();
    const idx    = scores.findIndex(s => s.username.toLowerCase() === username.toLowerCase());
    if (idx !== -1) {
      // Update if higher score
      if (score > scores[idx].score) scores[idx].score = score;
      scores[idx].games = (scores[idx].games || 0) + 1;
      scores[idx].lastSeen = Date.now();
      scores[idx].badgeIcon = badgeIcon || null; // keep in sync with whatever's equipped now
    } else {
      scores.push({
        username,
        score,
        games:    games || 1,
        lastSeen: Date.now(),
        avatar:   Math.floor(Math.random() * AVATAR_COLORS.length),
        badgeIcon: badgeIcon || null,
      });
    }
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(KEYS.scores, JSON.stringify(scores));
    return scores;
  }

  // ── Get current user ───────────────────────────────────────────────────
  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem(KEYS.currentUser)); }
    catch(e) { return null; }
  }

  // ── Format number ──────────────────────────────────────────────────────
  function fmt(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  // ── Render leaderboard ─────────────────────────────────────────────────
  function render(filter = "") {
    const scores  = loadScores();
    const user    = getCurrentUser();
    const list    = document.getElementById("lbList");
    const q       = filter.toLowerCase().trim();

    // Show your rank
    if (user) {
      const yourIdx = scores.findIndex(s => s.username.toLowerCase() === user.username.toLowerCase());
      const yourRank = document.getElementById("yourRank");
      if (yourIdx !== -1) {
        yourRank.innerHTML = `
          <span class="your-rank-label">YOUR RANK</span>
          <span class="your-rank-info">#${yourIdx + 1} — ${user.username} — ${fmt(scores[yourIdx].score)}</span>
        `;
        yourRank.classList.add("show");
      }
    }

    // Filter
    const filtered = q
      ? scores.filter(s => s.username.toLowerCase().includes(q))
      : scores;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="lb-empty">${q ? `No player found for "${filter}"` : "No scores yet — be the first!"}</div>`;
      return;
    }

    list.innerHTML = "";

    filtered.forEach((entry, i) => {
      const globalRank = scores.indexOf(entry) + 1;
      const isYou      = user && entry.username.toLowerCase() === user.username.toLowerCase();
      const color      = AVATAR_COLORS[entry.avatar % AVATAR_COLORS.length];
      const initial    = entry.username.charAt(0).toUpperCase();
      const delay      = Math.min(i * 30, 300);

      let rankEl = "";
      if (globalRank === 1) rankEl = `<span class="col-rank rank-1">🥇</span>`;
      else if (globalRank === 2) rankEl = `<span class="col-rank rank-2">🥈</span>`;
      else if (globalRank === 3) rankEl = `<span class="col-rank rank-3">🥉</span>`;
      else rankEl = `<span class="col-rank rank-other">#${globalRank}</span>`;

      const row = document.createElement("div");
      row.className = `lb-row${isYou ? " you" : ""}${globalRank <= 3 ? " rank-top" : ""}`;
      row.style.animationDelay = `${delay}ms`;
      row.innerHTML = `
        ${rankEl}
        <div class="col-player">
          <div class="player-avatar" style="background:${color}22;border:1px solid ${color}44">
            <span style="color:${color}">${initial}</span>
          </div>
          <span class="player-name" title="${entry.username}">${entry.badgeIcon ? entry.badgeIcon + " " : ""}${entry.username}</span>
          ${isYou ? '<span class="player-badge">YOU</span>' : ""}
        </div>
        <span class="col-score">${fmt(entry.score)}</span>
        <span class="col-games">${entry.games || 1}x</span>
      `;
      list.appendChild(row);
    });
  }

  // ── Search ─────────────────────────────────────────────────────────────
  document.getElementById("lbSearch").addEventListener("input", function() {
    render(this.value);
  });

  // ── Canvas particles ───────────────────────────────────────────────────
  const canvas = document.getElementById("lbCanvas");
  const ctx    = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const particles = Array.from({ length: 40 }, () => ({
    x:   Math.random() * window.innerWidth,
    y:   Math.random() * window.innerHeight,
    vx:  (Math.random() - 0.5) * 0.3,
    vy:  (Math.random() - 0.5) * 0.3,
    r:   Math.random() * 1.5 + 0.3,
    a:   Math.random(),
  }));

  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(103,215,240,${0.05 + Math.abs(Math.sin(Date.now() * 0.001 + p.a)) * 0.08})`;
      ctx.fill();
    });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  // ── Init ───────────────────────────────────────────────────────────────
  render();

  // ── Export saveScore so game can call it after each game ───────────────
  window.LB = { saveScore, loadScores };

  console.log("🏆 Leaderboard loaded!");

})();

/* ═══════════════════════════════════════
   INDEX PAGE — SESSION CHECK
═══════════════════════════════════════ */
(function() {
  // Don't redirect if we just came from login
  const justLoggedIn = sessionStorage.getItem("cg_just_logged_in");
  if (justLoggedIn) {
    sessionStorage.removeItem("cg_just_logged_in");
    return;
  }
  const from = document.referrer;
  if (from.includes("login.html")) return;

  try {
    const user = JSON.parse(localStorage.getItem("cg_current_user"));
    if (!user) {
      const hasLang = localStorage.getItem("cg_lang");
      window.location.replace(hasLang ? "./login.html" : "./lang.html");
    }
  } catch(e) {
    window.location.replace("./lang.html");
  }
})();



/* ═══════════════════════════════════════
   GUEST BLOCK — runs on leaderboard page
═══════════════════════════════════════ */
(function() {
  try {
    const user = JSON.parse(localStorage.getItem("cg_current_user"));
    const isGuest = !user || user.isGuest === true;
    if (isGuest) {
      // Hide the real content, show the block
      document.getElementById("guestBlock").style.display = "flex";
      const table   = document.querySelector(".lb-table-wrap");
      const search  = document.querySelector(".lb-search-wrap");
      const rank    = document.getElementById("yourRank");
      if (table)  table.style.display  = "none";
      if (search) search.style.display = "none";
      if (rank)   rank.style.display   = "none";
    }
  } catch(e) {}
})();
