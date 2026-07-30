// lobby.js
// Client-side controller for lobby.html — Team Versus (1v1..4v4).
// Wires the lobby UI to CubeMultiplayer and keeps the screen states in sync.
// ============================================================================

(function () {
  "use strict";

  const MP = window.CubeMultiplayer;
  if (!MP) {
    console.error("CubeMultiplayer is missing. Make sure multiplayer.js loads first.");
    return;
  }

  // Map pool for the pre-match vote. Server only validates ids and tallies
  // votes (see MAP_IDS in server.js) — all visuals live here.
  const MAP_POOL = [
    {
      id: "neon-grid", name: "Neon Grid", desc: "Classic cyber arena", icon: "◆",
      sky: ["#0a0e1e", "#1b2140"], floor: ["#181c2e", "#05060c"],
      line: "rgba(123,108,255,0.10)", accent: "#7b6cff",
    },
    {
      id: "sunset-dune", name: "Sunset Dune", desc: "Warm desert dusk", icon: "▲",
      sky: ["#2b1055", "#ff7847"], floor: ["#5c2a1b", "#140a06"],
      line: "rgba(255,154,77,0.14)", accent: "#ff9a4d",
    },
    {
      id: "deep-void", name: "Deep Void", desc: "Low-visibility void", icon: "●",
      sky: ["#000000", "#0d0d16"], floor: ["#050508", "#000000"],
      line: "rgba(0,229,160,0.12)", accent: "#00e5a0",
    },
  ];
  const DEFAULT_MAP = MAP_POOL[0];
  function mapById(id) { return MAP_POOL.find(m => m.id === id) || DEFAULT_MAP; }

  // ── Obstacles (Phase A/B/C: cover, verticality, per-map layouts) ─────────
  // NOTE: this layout data is mirrored in server.js (OBSTACLE_LAYOUTS) so the
  // server's authoritative hit detection can block shots the same way the
  // client renders/collides against them. If you change one, change both.
  //
  // type: 'wall'      — full height, always blocks movement + line of sight,
  //                      never climbable regardless of elevation.
  //       'crate_low' — short enough to step onto automatically, just by
  //                      walking into its footprint (no vault needed).
  //       'crate_tall'— needs a vault (jump/climb button) to get on top of;
  //                      until vaulted, blocks like a wall.
  // x, y: world-space center. hw, hy: half-width/half-depth footprint.
  // h: height in the same units as player elevation.
  const OBSTACLE_LAYOUTS = {
    "neon-grid": [
      { id: "w1", type: "wall",       x: -130, y:  0,   hw: 14, hy: 65, h: 140 },
      { id: "w2", type: "wall",       x:  130, y:  0,   hw: 14, hy: 65, h: 140 },
      { id: "c1", type: "crate_low",  x:    0, y: -95,  hw: 22, hy: 22, h:  36 },
      { id: "c2", type: "crate_tall", x:    0, y:  95,  hw: 26, hy: 26, h:  78 },
      { id: "c3", type: "crate_low",  x: -170, y: 160,  hw: 20, hy: 20, h:  34 },
      { id: "c4", type: "crate_low",  x:  170, y: -160, hw: 20, hy: 20, h:  34 },
    ],
    "sunset-dune": [
      { id: "w1", type: "wall",       x:    0, y: -140, hw: 70, hy: 14, h: 130 },
      { id: "w2", type: "wall",       x:    0, y:  140, hw: 70, hy: 14, h: 130 },
      { id: "c1", type: "crate_tall", x: -110, y:    0, hw: 24, hy: 24, h:  80 },
      { id: "c2", type: "crate_tall", x:  110, y:    0, hw: 24, hy: 24, h:  80 },
      { id: "c3", type: "crate_low",  x:  -60, y:  -60, hw: 20, hy: 20, h:  34 },
      { id: "c4", type: "crate_low",  x:   60, y:   60, hw: 20, hy: 20, h:  34 },
    ],
    "deep-void": [
      // Sparser — the low-visibility theme leans on fewer, bigger silhouettes.
      { id: "w1", type: "wall",       x: -90,  y:  90,  hw: 16, hy: 60, h: 150 },
      { id: "w2", type: "wall",       x:  90,  y: -90,  hw: 16, hy: 60, h: 150 },
      { id: "c1", type: "crate_tall", x:    0, y:    0, hw: 28, hy: 28, h:  82 },
      { id: "c2", type: "crate_low",  x: -150, y: -60,  hw: 20, hy: 20, h:  34 },
    ],
  };
  // How far a climbable crate's footprint keeps you clear of spawn (0,0) —
  // just a sanity note, not enforced in code: all layouts above stay clear
  // of a ~55-unit radius around the origin since that's where players spawn.

  const STEP_HEIGHT = 40;   // crates at or below this: auto climb, no button
  const VAULT_HEIGHT = 90;  // crates at or below this: climbable with the vault button
  const VAULT_REACH = 46;   // how close you need to be to a crate to vault it
  const VAULT_DURATION = 300; // ms for the climb-up arc

  // "Summon car" ultimate — must match server.js (CAR_COOLDOWN_MS etc).
  const CAR_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  const CAR_SPEED = 320;   // world units/sec — faster than a bullet
  const CAR_RANGE = 900;   // crosses the whole arena
  const CAR_HIT_RADIUS = 40;
  const CAR_DAMAGE = 100;

  function getObstacles() {
    const mapId = ARENA.map?.id || (state.roomState?.map) || DEFAULT_MAP.id;
    return OBSTACLE_LAYOUTS[mapId] || OBSTACLE_LAYOUTS[DEFAULT_MAP.id];
  }

  function isClimbable(obstacle) { return obstacle.type !== "wall" && obstacle.h <= VAULT_HEIGHT; }

  /** Closest point on an obstacle's AABB footprint to (x,y), and the
   *  distance to it — used for both collision push-out and vault-reach checks. */
  function closestPointOnObstacle(obstacle, x, y) {
    const cx = clamp(x, obstacle.x - obstacle.hw, obstacle.x + obstacle.hw);
    const cy = clamp(y, obstacle.y - obstacle.hy, obstacle.y + obstacle.hy);
    return { x: cx, y: cy, dist: Math.hypot(x - cx, y - cy) };
  }

  function insideFootprint(obstacle, x, y) {
    return Math.abs(x - obstacle.x) <= obstacle.hw && Math.abs(y - obstacle.y) <= obstacle.hy;
  }

  /** The height of "the ground" under (x,y) — 0 normally, or a crate's top
   *  if you're eligible to be standing on it (auto for low crates, only
   *  after vaulting for tall ones). */
  function groundHeightAt(x, y) {
    let ground = 0;
    for (const obs of getObstacles()) {
      if (!insideFootprint(obs, x, y)) continue;
      if (obs.type === "crate_low") ground = Math.max(ground, obs.h);
      else if (obs.type === "crate_tall" && ARENA.onTopId === obs.id) ground = Math.max(ground, obs.h);
    }
    return ground;
  }

  /** Push (x,y) out of any obstacle footprint the player isn't currently
   *  elevated above. Walls always apply; crates only if not standing on them. */
  function resolveObstacleCollision(x, y, elevation) {
    for (const obs of getObstacles()) {
      // "Cleared" must be specific to *this* obstacle, not just "elevation
      // is high enough" — otherwise standing on one tall crate would let
      // you clip straight through a different, unrelated crate elsewhere
      // that happens to be a similar height.
      let clearedIt;
      if (obs.type === "wall") clearedIt = false;
      else if (obs.type === "crate_low") clearedIt = elevation >= obs.h - 2 && insideFootprint(obs, x, y);
      else clearedIt = ARENA.onTopId === obs.id; // crate_tall: only the one actually vaulted
      if (clearedIt) continue;

      const nearestX = clamp(x, obs.x - obs.hw, obs.x + obs.hw);
      const nearestY = clamp(y, obs.y - obs.hy, obs.y + obs.hy);
      const dx = x - nearestX, dy = y - nearestY;
      const dist = Math.hypot(dx, dy);
      if (dist < ARENA.HIT_RADIUS && dist > 0.0001) {
        const push = (ARENA.HIT_RADIUS - dist);
        x += (dx / dist) * push;
        y += (dy / dist) * push;
      } else if (dist  ${message}`;
    }
  }

  function setReadyButton(ready) {
    state.ready = ready;
    if (!els.btnReady) return;
    els.btnReady.textContent = ready ? "UNREADY" : "READY";
    els.btnReady.classList.toggle("is-ready", ready);
  }

  function updateHeader() {
    if (els.badgeName) els.badgeName.textContent = state.profile.badgeIcon
      ? `${state.profile.badgeIcon} ${state.profile.name}`
      : state.profile.name;
    if (els.badgeEvo) els.badgeEvo.textContent = evoIcon(state.profile.evoStage);
    if (els.badgePing) els.badgePing.textContent = MP.latency ? `${MP.latency} ms` : "-- ms";
  }

  function evoIcon(stage) {
    if (stage >= 6) return "🌈";
    if (stage >= 5) return "🌌";
    if (stage >= 4) return "🔥";
    if (stage >= 3) return "⚡";
    if (stage >= 2) return "⭐";
    return "★";
  }

  function clearNode(node) {
    if (node) node.innerHTML = "";
  }

  function initialsFor(name) {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  function createPlayerRow(roomState, player) {
    const item = document.createElement("div");
    item.className = "player-item";
    item.classList.add(player.team === "B" ? "team-b" : "team-a");
    if (player.id === MP.myId) item.classList.add("is-me");
    if (player.ready) item.classList.add("is-ready");

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "player-avatar";
    if (player.photo) {
      avatarWrap.style.backgroundImage = `url('${player.photo}')`;
      avatarWrap.style.backgroundSize = "cover";
    } else {
      avatarWrap.textContent = initialsFor(player.name);
    }
    if (player.id === roomState.hostId) {
      const crown = document.createElement("span");
      crown.className = "player-host-crown";
      crown.textContent = "♛";
      crown.title = "Host";
      avatarWrap.appendChild(crown);
    }

    const evo = document.createElement("div");
    evo.className = "player-evo";
    evo.textContent = evoIcon(player.evoStage);

    const info = document.createElement("div");
    info.className = "player-info";

    const name = document.createElement("div");
    name.className = "player-name";
    name.textContent = player.badgeIcon ? `${player.badgeIcon} ${player.name || "Unknown"}` : (player.name || "Unknown");

    const meta = document.createElement("div");
    meta.className = "player-meta";

    const ping = document.createElement("span");
    ping.textContent = player.ping ? `${player.ping} ms` : "-- ms";

    meta.append(ping);
    info.append(name, meta);

    const status = document.createElement("div");
    status.className = "player-status";
    if (player.ready) status.classList.add("ready");
    if (player.id === roomState.hostId) status.classList.add("host");
    status.textContent = [
      player.id === roomState.hostId ? "HOST" : null,
      player.ready ? "READY" : null,
    ].filter(Boolean).join(" • ") || "WAITING";

    item.append(avatarWrap, evo, info, status);
    return item;
  }

  // Are we allowed to freely switch teams right now? Only pre-game, and not
  // during quick-play matches (those are auto-assigned and start instantly).
  function canSwitchTeams() {
    return !!state.roomState && state.roomState.state === "waiting" && !state.roomState.quickPlay;
  }

  function renderTeams(roomState) {
    if (!roomState || !els.teamAList || !els.teamBList) return;

    const teamSize = roomState.teamSize || 4;
    const teamA = roomState.teams?.A || [];
    const teamB = roomState.teams?.B || [];

    clearNode(els.teamAList);
    clearNode(els.teamBList);
    teamA.forEach(p => els.teamAList.appendChild(createPlayerRow(roomState, p)));
    teamB.forEach(p => els.teamBList.appendChild(createPlayerRow(roomState, p)));

    if (els.teamACount) els.teamACount.textContent = `${teamA.length}/${teamSize}`;
    if (els.teamBCount) els.teamBCount.textContent = `${teamB.length}/${teamSize}`;

    const totalPlayers = teamA.length + teamB.length;
    if (els.roomPlayerCount) els.roomPlayerCount.textContent = String(totalPlayers);
    if (els.roomMaxCount) els.roomMaxCount.textContent = String(teamSize * 2);

    if (els.roomModeBadge) {
      els.roomModeBadge.textContent = `TEAM VERSUS · ${teamSize}v${teamSize}`;
    }
    if (els.roomCodeDisplay) {
      els.roomCodeDisplay.textContent = roomState.quickPlay ? "QUICK PLAY" : (roomState.code || "------");
    }
    if (els.btnHostStart) {
      els.btnHostStart.classList.toggle("hidden", !MP.isHost || roomState.quickPlay);
    }

    // Join-team buttons: hide/disable based on current team, room state, and capacity
    const switchable = canSwitchTeams();
    [["A", els.btnJoinA, teamA], ["B", els.btnJoinB, teamB]].forEach(([team, btn, list]) => {
      if (!btn) return;
      const onThisTeam = MP.myTeam === team;
      const full = list.length >= teamSize;
      btn.classList.toggle("hidden", !switchable || onThisTeam);
      btn.disabled = full;
      btn.textContent = full ? "Team Full" : `Join Team ${team}`;
    });
  }

  function renderMapVotes(roomState) {
    if (!roomState || !els.mapVoteCards) return;
    const tally = roomState.mapVotes || {};
    const allPlayers = [...(roomState.teams?.A || []), ...(roomState.teams?.B || [])];

    clearNode(els.mapVoteCards);
    MAP_POOL.forEach(map => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "map-card";
      card.style.setProperty("--map-a", map.sky[0]);
      card.style.setProperty("--map-b", map.sky[1]);
      card.style.setProperty("--map-accent", map.accent);

      const myVote = allPlayers.find(p => p.id === MP.myId)?.mapVote;
      if (myVote === map.id) card.classList.add("selected");

      const count = tally[map.id] || 0;
      const voters = allPlayers.filter(p => p.mapVote === map.id);

      card.innerHTML = `
        <div class="map-card-thumb">
          <span class="map-card-icon">${map.icon}</span>
        </div>
        <div class="map-card-name">${map.name}</div>
        <div class="map-card-desc">${map.desc}</div>
        <div class="map-card-votes">${count ? `${count} vote${count === 1 ? "" : "s"}` : "No votes yet"}</div>
      `;
      if (voters.length) {
        const avatars = document.createElement("div");
        avatars.className = "map-card-voter-avatars";
        voters.slice(0, 4).forEach(v => {
          const dot = document.createElement("span");
          dot.className = "map-voter-dot";
          dot.title = v.name || "Player";
          dot.textContent = (v.name || "?").charAt(0).toUpperCase();
          avatars.appendChild(dot);
        });
        card.appendChild(avatars);
      }

      card.addEventListener("click", () => MP.voteMap(map.id));
      els.mapVoteCards.appendChild(card);
    });
  }

  function createChatRow(msg) {
    const row = document.createElement("div");
    row.className = "chat-msg";
    if (msg.playerId === MP.myId) row.classList.add("me");
    if (msg.system) row.classList.add("system");

    if (msg.system) {
      const text = document.createElement("span");
      text.className = "msg-text";
      text.textContent = msg.message || "";
      row.appendChild(text);
      return row;
    }

    const name = document.createElement("span");
    name.className = "msg-name";
    name.textContent = msg.team ? `[${msg.team}] ${msg.name || "Unknown"}:` : `${msg.name || "Unknown"}:`;

    const text = document.createElement("span");
    text.className = "msg-text";
    text.textContent = ` ${msg.message || ""}`;

    row.append(name, text);
    return row;
  }

  function renderChatMessage(msg) {
    if (!els.chatMessages) return;
    els.chatMessages.appendChild(createChatRow(msg));
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  function createRoomRow(room) {
    const item = document.createElement("div");
    item.className = "room-list-item";

    const code = document.createElement("div");
    code.className = "rli-code";
    code.textContent = room.code;

    const mode = document.createElement("div");
    mode.className = "rli-mode";
    mode.textContent = `${room.teamSize}v${room.teamSize}`;

    const host = document.createElement("div");
    host.className = "rli-host";
    host.textContent = room.host || "Unknown";

    const count = document.createElement("div");
    count.className = "rli-count";
    count.textContent = `${room.teamACount}v${room.teamBCount} (max ${room.teamSize})`;

    const join = document.createElement("button");
    join.className = "btn-secondary rli-join";
    join.textContent = "JOIN";
    join.addEventListener("click", () => joinRoom(room.code));

    item.append(code, mode, host, count, join);
    return item;
  }

  function renderRoomList(list) {
    if (!els.roomList) return;
    clearNode(els.roomList);

    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "room-list-empty";
      empty.textContent = "No open rooms — create one!";
      els.roomList.appendChild(empty);
      return;
    }

    list.forEach(room => {
      els.roomList.appendChild(createRoomRow(room));
    });
  }

  function updateQueueTimer() {
    if (!state.queueStartedAt || !els.queueTimer) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - state.queueStartedAt) / 1000));
    const mins = Math.floor(elapsed / 60);
    const secs = String(elapsed % 60).padStart(2, "0");
    els.queueTimer.textContent = `${mins}:${secs}`;
  }

  function startQueueTimer() {
    stopQueueTimer();
    state.queueStartedAt = Date.now();
    updateQueueTimer();
    state.queueTimerId = setInterval(updateQueueTimer, 1000);
  }

  function stopQueueTimer() {
    if (state.queueTimerId) {
      clearInterval(state.queueTimerId);
      state.queueTimerId = null;
    }
    state.queueStartedAt = 0;
  }

  async function refreshRooms() {
    try {
      const rooms = await MP.getRooms();
      renderRoomList(rooms);
    } catch (err) {
      showToast(err?.message || "Failed to load rooms", "error");
    }
  }

  async function joinRoom(code, team) {
    const cleaned = String(code || els.joinCodeInput?.value || "").trim().toUpperCase();
    if (!cleaned) {
      showToast("Enter a room code first", "error");
      return;
    }

    try {
      await MP.joinRoom(cleaned, team, state.profile);
      setScreen("room");
      showToast(`Joined room ${cleaned}`, "success");
    } catch (err) {
      showToast(err || "Could not join room", "error");
    }
  }

  async function createRoom(teamSize) {
    try {
      await MP.createRoom(teamSize, state.profile);
      setScreen("room");
      setReadyButton(false);
      showToast(`Created ${teamSize}v${teamSize} room`, "success");
    } catch (err) {
      showToast(err || "Could not create room", "error");
    }
  }

  async function doSwitchTeam(team) {
    try {
      await MP.switchTeam(team);
    } catch (err) {
      showToast(err || "Could not switch team", "error");
    }
  }

  function joinQueue(size) {
    if (!MP.connected) {
      showToast("Connecting to server…", "error");
      return;
    }
    state.queueSize = size;
    MP.joinQueue(size, state.profile);
    setScreen("queue");
    if (els.queueTitle) {
      els.queueTitle.textContent = `Finding ${size}v${size} Match…`;
    }
    if (els.queueSub) els.queueSub.textContent = "Position 1 in queue";
    startQueueTimer();
  }

  function leaveQueue() {
    MP.leaveQueue();
    stopQueueTimer();
    state.queueSize = null;
    setScreen("home");
  }

  function leaveRoom() {
    MP.leaveRoom();
    state.roomState = null;
    setReadyButton(false);
    stopQueueTimer();
    stopArenaLoop();
    hideArena();
    if (els.mpHud) els.mpHud.classList.add("hidden");
    setScreen("home");
  }

  function showEndOverlay(data) {
    if (!els.overlayEnd) return;

    // Match is over — stop the arena loop and hide it + the HUD
    stopArenaLoop();
    hideArena();
    if (els.mpHud) els.mpHud.classList.add("hidden");

    const isWinner = data.winnerTeam && MP.myTeam === data.winnerTeam;
    const isDraw = !data.winnerTeam;

    if (els.endTrophy) els.endTrophy.textContent = isDraw ? "🤝" : (isWinner ? "🏆" : "😔");
    if (els.endTitle) {
      els.endTitle.textContent = isDraw ? "DRAW" : (isWinner ? "VICTORY!" : "DEFEATED");
    }

    if (els.endScoreboard) {
      els.endScoreboard.innerHTML = "";

      // Series score across rematches in this room, e.g. "1-0"
      if (data.seriesScore) {
        const series = document.createElement("div");
        series.className = "score-row series-summary";
        series.innerHTML = `<span class="score-name">SERIES — TEAM A ${data.seriesScore.A ?? 0} - ${data.seriesScore.B ?? 0} TEAM B</span>`;
        els.endScoreboard.appendChild(series);
      }

      // Team score summary at the top
      if (data.teamScores) {
        const summary = document.createElement("div");
        summary.className = "score-row team-summary";
        summary.innerHTML = `
          <span class="score-name">TEAM A: ${data.teamScores.A ?? 0}</span>
          <span class="score-name">TEAM B: ${data.teamScores.B ?? 0}</span>
        `;
        els.endScoreboard.appendChild(summary);
      }

      (data.scores || []).forEach((entry, i) => {
        const row = document.createElement("div");
        row.className = "score-row";
        if (entry.team === data.winnerTeam) row.classList.add("winner");
        row.innerHTML = `
          <span class="score-rank">#${i + 1}</span>
          <span class="score-name">[${entry.team}] ${entry.name || "Unknown"}${entry.id === MP.myId ? " (you)" : ""}</span>
          <span class="score-val">${entry.score ?? 0}</span>
        `;
        els.endScoreboard.appendChild(row);
      });
    }

    els.overlayEnd.classList.remove("hidden");
  }

  function hideEndOverlay() {
    if (els.overlayEnd) els.overlayEnd.classList.add("hidden");
  }

  // ── Background canvas ────────────────────────────────────────────────────

  function initBgCanvas() {
    const canvas = els.bgCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const particles = [];
    const PARTICLE_COUNT = 60;

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function spawnParticle() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.5 ? "123,108,255" : "0,229,160"
      };
    }

    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(spawnParticle());

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = "rgba(100,120,255,0.04)";
      ctx.lineWidth = 1;
      const step = 60;
      for (let x = 0; x < canvas.width; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    draw();
  }

  function handleRoomState(roomState) {
    state.roomState = roomState;
    updateHeader();
    renderTeams(roomState);
    renderMapVotes(roomState);
    if (els.seriesScoreBadge) {
      const s = roomState.seriesScore;
      const hasScore = s && (s.A > 0 || s.B > 0);
      els.seriesScoreBadge.classList.toggle("hidden", !hasScore);
      if (hasScore) els.seriesScoreBadge.textContent = `${s.A} - ${s.B}`;
    }
    setScreen("room");
  }

  function handleCountdown(data) {
    setScreen("countdown");
    if (els.countdownNum) els.countdownNum.textContent = String(data?.count ?? 3);
  }

  function handleGameStart() {
    showToast("Game starting!", "success");
    ARENA.map = mapById(state.roomState?.map);
    // Hide all lobby screens; the arena canvas takes over
    Object.values(screens).forEach(el => el?.classList.remove("active"));
    if (els.overlayEnd) els.overlayEnd.classList.add("hidden");
    if (els.mpHud) {
      els.mpHud.classList.remove("hidden");
      renderHud();
    }
    showArena();
    startArenaLoop();
  }

  // ── Arena (top-down in-match view) ───────────────────────────────────────
  // Movement + shooting placeholder. Positions are synced through the
  // server (already anti-cheat checked there). Shots are relayed by the
  // server but hit-detected locally by whoever gets hit — same trust model
  // the codebase already uses for playerDied — the server just clamps the
  // damage amount so a modified client can't one-shot people.

  const ARENA = {
    WORLD_HALF: 320,     // arena spans -320..320 on each axis
    SPEED: 180,          // world units per second
    BULLET_SPEED: 460,   // world units per second
    BULLET_RANGE: 480,   // max travel distance before a bullet expires
    HIT_RADIUS: 20,      // world units — bullet-to-player hit distance
    MAX_HP: 150,
    FIRE_COOLDOWN: 220,  // ms between local shots
    TURN_SPEED: 2.4,     // rad/sec applied by the touch aim-stick
    running: false,
    ctx: null,
    keys: { up: false, down: false, left: false, right: false },
    joy: { active: false, x: 0, y: 0 },     // -1..1 movement vector
    aimJoy: { active: false, x: 0, y: 0 },  // -1..1 look/fire vector (mobile)
    myPos: { x: 0, y: 0 },
    yaw: 0,              // facing angle — first-person look direction
    hp: 150,
    dead: false,
    bullets: [],         // { x, y, dx, dy, team, ownerId, mine, dist, hitConfirmed }
    lastShotAt: 0,
    gunRecoil: 0,
    muzzleFlashUntil: 0,
    shotStreak: 0,       // consecutive shots without a pause — drives recoil/bloom
    shake: 0,            // screen-shake magnitude, decays every frame
    hitMarkerUntil: 0,   // crosshair shows a hit marker until this timestamp
    hurtFlashUntil: 0,   // red vignette shown briefly after taking damage
    correctionTarget: null, // server-authoritative position to smoothly pull toward (Phase 4 reconciliation)
    elevation: 0,        // current height above ground (crates/vaulting)
    onTopId: null,        // id of the tall crate we're currently standing on, if any
    vault: null,          // { obstacleId, from, to, startedAt } while a vault is in progress
    cars: [],             // summon-car ultimate: traveling car objects, same shape idea as bullets
    lastCarSummonAt: 0,   // client-side optimistic guess — server is authoritative (carSummonDenied corrects us)
    dragging: false,     // desktop: mouse-drag-to-look
    lastDragX: 0,
    dragMoved: 0,
    lastFrame: 0,
    rafId: null,
  };

  function getForward() { return { x: Math.sin(ARENA.yaw), y: -Math.cos(ARENA.yaw) }; }
  function getRight()   { return { x: Math.cos(ARENA.yaw), y:  Math.sin(ARENA.yaw) }; }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /** Each frame: smoothly move elevation toward whatever the ground under
   *  us currently is (instant-ish for stepping onto a low crate, or a
   *  gentle "fall" back to 0 when walking off a tall one), unless a vault
   *  arc is actively in progress. */
  function updateElevation(dt) {
    if (ARENA.vault) {
      const elapsed = performance.now() - ARENA.vault.startedAt;
      const t = clamp(elapsed / VAULT_DURATION, 0, 1);
      const eased = 1 - Math.pow(1 - t, 2); // ease-out
      ARENA.elevation = ARENA.vault.from + (ARENA.vault.to - ARENA.vault.from) * eased;
      if (t >= 1) {
        ARENA.onTopId = ARENA.vault.obstacleId;
        ARENA.vault = null;
      }
      return;
    }

    // Not vaulting — if we're still within a tall crate's footprint we're
    // on top of, hold that height; otherwise fall back toward whatever's
    // actually under us (0, or a low crate we just stepped onto/off of).
    if (ARENA.onTopId) {
      const obs = getObstacles().find(o => o.id === ARENA.onTopId);
      if (!obs || !insideFootprint(obs, ARENA.myPos.x, ARENA.myPos.y)) ARENA.onTopId = null;
    }
    const target = groundHeightAt(ARENA.myPos.x, ARENA.myPos.y);
    const diff = target - ARENA.elevation;
    if (Math.abs(diff) < 0.5) ARENA.elevation = target;
    else ARENA.elevation += diff * Math.min(1, 10 * dt);
  }

  /** Vault/climb button — finds the nearest vaultable crate within reach
   *  and starts a climb arc onto it. No-op if already elevated or nothing
   *  in reach. */
  function tryVault() {
    if (ARENA.dead || !ARENA.running || ARENA.vault || ARENA.elevation > 2) return;
    let best = null, bestDist = Infinity;
    for (const obs of getObstacles()) {
      if (obs.type !== "crate_tall") continue;
      const { dist } = closestPointOnObstacle(obs, ARENA.myPos.x, ARENA.myPos.y);
      if (dist <= VAULT_REACH && dist < bestDist) { best = obs; bestDist = dist; }
    }
    if (!best) return;
    ARENA.vault = { obstacleId: best.id, from: ARENA.elevation, to: best.h, startedAt: performance.now() };
  }

  function resizeArenaCanvas() {
    if (!els.arenaCanvas) return;
    els.arenaCanvas.width = window.innerWidth;
    els.arenaCanvas.height = window.innerHeight;
  }

  function isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }

  /** Fire a shot from my current position toward a world-space direction. */
  function fireShot(dx, dy) {
    if (ARENA.dead || !ARENA.running) return;
    const now = performance.now();
    if (now - ARENA.lastShotAt <span>${evoIcon(player.evoStage)}</span><span>${player.name}</span><span style="color:var(--gold)">${player.score ?? 0}</span>`;
      els.hudPlayers.appendChild(pill);
    });
    if (els.hudLatency) els.hudLatency.textContent = `${MP.latency || "--"} ms`;
  }

  function sendChat() {
    const input = els.chatInput;
    if (!input) return;
    const message = input.value.trim();
    if (!message) return;
    MP.sendChat(message);
    input.value = "";
  }

  function wireEvents() {
    MP.on("connected", () => {
      setConnectStatus("Connected to server.");
      setScreen("home");
      updateHeader();
      refreshRooms();
    });

    MP.on("reconnected", () => {
      showToast("Reconnected to server", "success");
      setScreen("home");
      updateHeader();
    });

    MP.on("disconnected", () => {
      stopArenaLoop();
      hideArena();
      if (els.mpHud) els.mpHud.classList.add("hidden");
      setConnectStatus("Disconnected. Reconnecting…");
      setScreen("connect");
    });

    MP.on("serverError", (err) => {
      showToast(err?.message || "Server error", "error");
    });

    MP.on("kicked", (data) => {
      stopArenaLoop();
      hideArena();
      if (els.mpHud) els.mpHud.classList.add("hidden");
      showToast(data?.reason || "Kicked from server", "error");
    });

    MP.on("queueStatus", (data) => {
      if (els.queuePos) els.queuePos.textContent = String(data?.position || 1);
      if (els.queueSub) els.queueSub.textContent = `Position ${data?.position || 1} in queue`;
      if (els.queueCount) els.queueCount.textContent = `${data?.total || 0} in queue`;
      if (!state.queueStartedAt) startQueueTimer();
      setScreen("queue");
    });

    MP.on("matchFound", (data) => {
      stopQueueTimer();
      const size = data?.teamSize || state.queueSize;
      if (els.queueTitle) els.queueTitle.textContent = "Room Found!";
      if (els.queueSub) els.queueSub.textContent = `${size}v${size} match ready — joining…`;
      showToast(`Room found — ${size}v${size}`, "success");
    });

    MP.on("roomState", handleRoomState);
    MP.on("playerJoined", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
      if (data?.player) {
        renderChatMessage({ system: true, message: `${data.player.name} joined Team ${data.player.team}.` });
      }
    });
    MP.on("playerLeft", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
      if (data?.playerId) {
        renderChatMessage({ system: true, message: `A player left the room.` });
      }
    });
    MP.on("playerReady", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
    });
    MP.on("teamChanged", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
      renderChatMessage({ system: true, message: `A player switched to Team ${data?.team}.` });
    });
    MP.on("hostChanged", () => {
      if (state.roomState) renderTeams(state.roomState);
      renderChatMessage({ system: true, message: "Host has changed." });
    });
    MP.on("chat", renderChatMessage);
    MP.on("mapVoteUpdate", (data) => {
      if (data?.roomState) { state.roomState = data.roomState; renderMapVotes(data.roomState); }
    });
    MP.on("roomReset", (data) => {
      if (data?.roomState) {
        handleRoomState(data.roomState);
        setReadyButton(false);
      }
    });
    MP.on("countdown", handleCountdown);
    MP.on("gameStart", handleGameStart);
    MP.on("remoteState", () => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("remoteShoot", spawnRemoteBullet);
    MP.on("carSummoned", (d) => {
      if (!d || d.playerId === MP.myId) return;
      ARENA.cars.push({
        x: d.x, y: d.y, dx: d.dx, dy: d.dy,
        team: d.team, ownerId: d.playerId, mine: false, dist: 0, elevation: d.elevation || 0,
      });
    });
    MP.on("carSummonDenied", (d) => {
      const remaining = typeof d?.remainingMs === "number" ? d.remainingMs : CAR_COOLDOWN_MS;
      // Server is authoritative — correct our optimistic local timer so the
      // button reflects reality (matters most right after reconnecting).
      ARENA.lastCarSummonAt = Date.now() - (CAR_COOLDOWN_MS - remaining);
      showToast(`Car summon on cooldown — ${formatDuration(remaining)} left`, "error");
    });
    MP.on("positionCorrection", (data) => {
      if (data?.position && isFinite(data.position.x) && isFinite(data.position.y)) {
        ARENA.correctionTarget = { x: data.position.x, y: data.position.y };
      }
    });
    MP.on("remoteHealth", (data) => {
      if (data?.playerId === MP.myId && typeof data.hp === "number") {
        applyAuthoritativeHp(data.hp);
      }
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("playerDied", (data) => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
      if (data?.playerId !== MP.myId) {
        const p = MP.allPlayers().find(pl => pl.id === data?.playerId);
        renderChatMessage({ system: true, message: `${p?.name || "A player"} was eliminated.` });
      }
    });
    MP.on("ping", () => {
      updateHeader();
      if (els.hudLatency) els.hudLatency.textContent = `${MP.latency || "--"} ms`;
    });
    MP.on("gameEnd", (data) => {
      showEndOverlay(data);
    });
  }

  function wireUi() {
    // Size pickers: Quick Play + Create Room
    document.querySelectorAll(".size-picker[data-action='queue'] .btn-size").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".size-picker[data-action='queue'] .btn-size")
          .forEach(b => b.classList.toggle("selected", b === btn));
        joinQueue(parseInt(btn.dataset.size, 10));
      });
    });

    document.querySelectorAll(".size-picker[data-action='create'] .btn-size").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".size-picker[data-action='create'] .btn-size")
          .forEach(b => b.classList.toggle("selected", b === btn));
        createRoom(parseInt(btn.dataset.size, 10));
      });
    });

    els.btnJoinCode?.addEventListener("click", () => joinRoom());
    els.joinCodeInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") joinRoom();
    });

    els.btnJoinA?.addEventListener("click", () => doSwitchTeam("A"));
    els.btnJoinB?.addEventListener("click", () => doSwitchTeam("B"));

    els.btnBrowse?.addEventListener("click", async () => {
      setScreen("browse");
      await refreshRooms();
    });

    els.btnRefreshRooms?.addEventListener("click", refreshRooms);
    els.btnBackBrowse?.addEventListener("click", () => setScreen("home"));
    els.btnCancelQueue?.addEventListener("click", leaveQueue);

    els.btnReady?.addEventListener("click", () => {
      const next = !state.ready;
      MP.setReady(next);
      setReadyButton(next);
    });

    els.btnHostStart?.addEventListener("click", () => MP.hostStart());
    els.btnLeaveRoom?.addEventListener("click", leaveRoom);
    els.btnLeaveMatch?.addEventListener("click", leaveRoom);

    els.btnCopyCode?.addEventListener("click", async () => {
      const code = state.roomState?.code || els.roomCodeDisplay?.textContent || "";
      if (!code || code === "------" || code === "QUICK PLAY") return;
      try {
        await navigator.clipboard.writeText(code);
        showToast("Room code copied", "success");
      } catch {
        showToast("Could not copy code", "error");
      }
    });

    els.btnSendChat?.addEventListener("click", sendChat);
    els.chatInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") sendChat();
    });

    els.btnPlayAgain?.addEventListener("click", () => {
      MP.playAgain();
      hideEndOverlay();
      showToast("Waiting for the room to reset...", "success");
    });

    els.btnEndLobby?.addEventListener("click", () => {
      hideEndOverlay();
      leaveRoom();
    });

    document.addEventListener("keydown", e => {
      if (e.key !== "Escape") return;
      if (screens.browse?.classList.contains("active")) {
        setScreen("home");
      } else if (state.queueTimerId) {
        leaveQueue();
      }
    });
  }

  function init() {
    updateHeader();
    setReadyButton(false);
    setConnectStatus("Connecting to server…");
    initBgCanvas();
    initArenaControls();
    wireEvents();
    wireUi();

    if (!MP.socket) {
      MP.connect();
    }

    setScreen("connect");

    if (MP.connected) {
      setScreen("home");
      refreshRooms();
    }
  }

  init();
})();
