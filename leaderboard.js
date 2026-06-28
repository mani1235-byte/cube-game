// leaderboard.js — CUBE GAME Global Leaderboard
// Backed by the server's /api/leaderboard and /api/score endpoints (Firestore
// via Admin SDK on the server side — see server.js). The board, season timer,
// and season results are now shared across every player and every device.
// ============================================================================

(function () {
  "use strict";

  const KEYS = {
    currentUser: "cg_current_user",
  };

  // ── Avatar colors per rank ─────────────────────────────────────────────
  const AVATAR_COLORS = [
    "#67d7f0","#a6e02c","#fa2473","#fe9522","#cc00ff",
    "#ff2200","#00ffcc","#ffdd00","#0088ff","#ff6600",
  ];

  // ── Rank chest display info ─────────────────────────────────────────────
  // Mirrors the chest ids the server hands out (server.js RANK_CHESTS) and
  // progression/data/chest-table.js. Rewards write straight into the same
  // save slot ChestSystem reads from (cg_progression_v1) — chest inventory
  // stays a local/per-device thing, same as the rest of progression.
  const RANK_CHESTS = {
    1: { id: "legendary", rarity: 5, name: "Legendary Chest", image: "progression/assets/images/legendray chest.png" },
    2: { id: "crystal",   rarity: 4, name: "Crystal Chest",   image: "progression/assets/images/crystal chest.png" },
    3: { id: "gold",      rarity: 3, name: "Gold Chest",      image: "progression/assets/images/golden chest.png" },
    4: { id: "silver",    rarity: 2, name: "Silver Chest",    image: "progression/assets/images/silver chest.png" },
    5: { id: "wooden",    rarity: 1, name: "Wooden Chest",    image: "progression/assets/images/wooden chest.png" },
  };
  const CHEST_BY_ID = {};
  Object.values(RANK_CHESTS).forEach(c => { CHEST_BY_ID[c.id] = c; });

  const RARITY_BY_ID    = { wooden: 1, silver: 2, gold: 3, crystal: 4, legendary: 5 };
  const PROGRESSION_KEY = "cg_progression_v1";   // must match progression-config.js storageKey
  const CHEST_CAP       = 8;                     // must match progression-config.js chests.maxQueued
  const DAY_MS           = 24 * 60 * 60 * 1000;

  function formatTimeLeft(ms) {
    if (ms <= 0) return "ending…";
    const d = Math.floor(ms / DAY_MS);
    const h = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  // Drops chest straight into the shared chestInventory array, dropping the
  // lowest-rarity chest if full — same overflow rule as ChestSystem.addToInventory.
  function grantChestToInventory(chestId) {
    let state = {};
    try { state = JSON.parse(localStorage.getItem(PROGRESSION_KEY) || "{}"); } catch (e) {}
    state.chestInventory = state.chestInventory || [];
    if (state.chestInventory.length >= CHEST_CAP) {
      state.chestInventory.sort((a, b) => (RARITY_BY_ID[a] || 99) - (RARITY_BY_ID[b] || 99));
      state.chestInventory.shift();
    }
    state.chestInventory.push(chestId);
    try { localStorage.setItem(PROGRESSION_KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ── Chest toast ───────────────────────────────────────────────────────────
  function showChestToast(chest, label) {
    const el = document.createElement("div");
    el.className = "lb-chest-toast";
    el.innerHTML = `
      <img src="${chest.image}" alt="${chest.name}">
      <span>${label || `You earned a <b>${chest.name}</b>!`}</span>
    `;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 400);
    }, 4500);
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

  // ── Server calls ─────────────────────────────────────────────────────────
  // GET the shared board + season info. Passing our own username lets the
  // server hand back a chest if we placed top-5 last season and haven't
  // claimed it yet — works no matter which device triggers the season
  // rollover, unlike the old localStorage version.
  async function fetchLeaderboard(username) {
    const qs = username ? `?username=${encodeURIComponent(username)}` : "";
    const res = await fetch(`/api/leaderboard${qs}`);
    if (!res.ok) throw new Error(`leaderboard fetch failed: ${res.status}`);
    return res.json();
  }

  // Fire-and-forget score submit — called by script.js after every match.
  // Network failures are swallowed (same "best effort" behavior the old
  // localStorage version had) so a flaky connection never breaks endGame().
  async function saveScore(username, score, games, badgeIcon) {
    try {
      const res = await fetch("/api/score", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, score, games, badgeIcon }),
      });
      if (!res.ok) console.warn("[LB] score submit rejected:", res.status);
    } catch (e) {
      console.warn("[LB] score submit failed:", e);
    }
  }

  // ── Render leaderboard ─────────────────────────────────────────────────
  async function render(filter = "") {
    const list = document.getElementById("lbList");
    const user = getCurrentUser();

    let data;
    try {
      data = await fetchLeaderboard(user ? user.username : null);
    } catch (e) {
      console.warn("[LB] render failed:", e);
      if (list) list.innerHTML = `<div class="lb-empty">Couldn't load the leaderboard — check your connection and try again.</div>`;
      return;
    }

    const { season, lastSeason, scores, earnedChestId } = data;

    if (earnedChestId) {
      const chest = CHEST_BY_ID[earnedChestId];
      if (chest) {
        grantChestToInventory(chest.id);
        showChestToast(chest, `Season ended — you earned a <b>${chest.name}</b>!`);
      }
    }

    const seasonEl = document.getElementById("lbSeason");
    if (seasonEl && season) {
      const msLeft = (season.startTime + season.durationMs) - Date.now();
      seasonEl.textContent = `SEASON ${season.index + 1} — ENDS IN ${formatTimeLeft(msLeft)}`;
    }
    renderLastSeasonPanel(lastSeason);

    const q = filter.toLowerCase().trim();

    // Show your rank (only meaningful within the fetched top rows)
    if (user) {
      const yourIdx = scores.findIndex(s => s.username.toLowerCase() === user.username.toLowerCase());
      const yourRank = document.getElementById("yourRank");
      if (yourRank) {
        if (yourIdx !== -1) {
          const rank  = yourIdx + 1;
          const chest = RANK_CHESTS[rank];
          yourRank.innerHTML = `
            <span class="your-rank-label">YOUR RANK</span>
            <span class="your-rank-info-wrap">
              <span class="your-rank-info">#${rank} — ${user.username} — ${fmt(scores[yourIdx].score)}</span>
              ${chest ? `<img class="your-rank-chest" src="${chest.image}" alt="${chest.name}" title="${chest.name} — locked in when the season ends">` : ""}
            </span>
          `;
          yourRank.classList.add("show");
        } else {
          yourRank.classList.remove("show");
        }
      }
    }

    // Filter
    const filtered = q
      ? scores.filter(s => s.username.toLowerCase().includes(q))
      : scores;

    if (!list) return;

    if (filtered.length === 0) {
      list.innerHTML = `<div class="lb-empty">${q ? `No player found for "${filter}"` : "No scores yet — be the first!"}</div>`;
      return;
    }

    list.innerHTML = "";

    filtered.forEach((entry, i) => {
      const globalRank = scores.indexOf(entry) + 1;
      const isYou      = user && entry.username.toLowerCase() === user.username.toLowerCase();
      const color      = AVATAR_COLORS[(entry.avatar || 0) % AVATAR_COLORS.length];
      const initial    = entry.username.charAt(0).toUpperCase();
      const delay      = Math.min(i * 30, 300);

      let rankEl = "";
      const chest = RANK_CHESTS[globalRank];
      if (chest) {
        rankEl = `<span class="col-rank rank-chest" title="${chest.name} — locked in when the season ends">
          <img class="rank-chest-icon" src="${chest.image}" alt="${chest.name}">
          <span class="rank-chest-num">#${globalRank}</span>
        </span>`;
      } else {
        rankEl = `<span class="col-rank rank-other">#${globalRank}</span>`;
      }

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

  // ── Last season results panel ──────────────────────────────────────────
  function renderLastSeasonPanel(last) {
    const panel = document.getElementById("lbLastSeason");
    if (!panel) return;
    if (!last || !last.top5 || !last.top5.length) { panel.style.display = "none"; return; }

    panel.style.display = "flex";
    panel.innerHTML = `<span class="last-season-label">SEASON ${last.index + 1} RESULTS</span>` +
      last.top5.map(t => {
        const chest = RANK_CHESTS[t.rank];
        return `<span class="last-season-entry" title="${t.username} — ${chest.name}">
          <img src="${chest.image}" alt="${chest.name}">
          <span>#${t.rank} ${t.username}</span>
        </span>`;
      }).join("");
  }

  // ── Search ─────────────────────────────────────────────────────────────
  // Guarded: leaderboard.js is also loaded on the game page (index.html) so
  // window.LB.saveScore exists there for endGame() to call. index.html has
  // no #lbSearch, so this used to throw and crash the whole script BEFORE
  // it reached `window.LB = {...}` below — which silently broke score
  // saving on every match. Only run this on the actual leaderboard page.
  const lbSearchEl = document.getElementById("lbSearch");
  if (lbSearchEl) {
    lbSearchEl.addEventListener("input", function() {
      render(this.value);
    });
  }

  // ── Canvas particles ───────────────────────────────────────────────────
  const canvas = document.getElementById("lbCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");

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
  }

  // ── Init ───────────────────────────────────────────────────────────────
  // render() touches #lbList/#yourRank, which only exist on leaderboard.html
  // — same reasoning as above, only run it there.
  if (document.getElementById("lbList")) render();

  // ── Export so the game can call it after each match ─────────────────────
  window.LB = { saveScore, fetchLeaderboard };

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
