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
      } else if (dist <= 0.0001) {
        // Dead-center inside (rare) — push out along the shortest axis.
        const overlapX = obs.hw + ARENA.HIT_RADIUS - Math.abs(x - obs.x);
        const overlapY = obs.hy + ARENA.HIT_RADIUS - Math.abs(y - obs.y);
        if (overlapX < overlapY) x += (x < obs.x ? -overlapX : overlapX);
        else y += (y < obs.y ? -overlapY : overlapY);
      }
    }
    return { x, y };
  }

  /** Does a straight line from (ox,oy) to (tx,ty) pass through any obstacle
   *  that neither end is high enough to see over? Used to make walls/crates
   *  actually block shots instead of just being decoration. */
  function lineOfSightBlocked(ox, oy, tx, ty, shooterElevation, targetElevation) {
    for (const obs of getObstacles()) {
      const clearOver = obs.type !== "wall" && Math.min(shooterElevation, targetElevation) >= obs.h - 2;
      if (clearOver) continue;
      if (segmentIntersectsAABB(ox, oy, tx, ty, obs)) return true;
    }
    return false;
  }

  /** Standard segment-vs-AABB intersection (slab method). */
  function segmentIntersectsAABB(x1, y1, x2, y2, obs) {
    const minX = obs.x - obs.hw, maxX = obs.x + obs.hw;
    const minY = obs.y - obs.hy, maxY = obs.y + obs.hy;
    let tmin = 0, tmax = 1;
    const dx = x2 - x1, dy = y2 - y1;
    for (const [d, lo, hi, p] of [[dx, minX, maxX, x1], [dy, minY, maxY, y1]]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) return false;
      } else {
        let t1 = (lo - p) / d, t2 = (hi - p) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return true;
  }

  const screens = {
    connect: document.getElementById("screen-connect"),
    home: document.getElementById("screen-home"),
    queue: document.getElementById("screen-queue"),
    room: document.getElementById("screen-room"),
    browse: document.getElementById("screen-browse"),
    countdown: document.getElementById("screen-countdown"),
  };

  const els = {
    connectStatus: document.getElementById("connect-status"),
    badgeEvo: document.getElementById("badge-evo"),
    badgeName: document.getElementById("badge-name"),
    badgePing: document.getElementById("badge-ping"),
    queueTitle: document.getElementById("queue-title"),
    queueSub: document.getElementById("queue-sub"),
    queuePos: document.getElementById("queue-pos"),
    queueTimer: document.getElementById("queue-timer"),
    queueCount: document.getElementById("queue-count"),
    roomModeBadge: document.getElementById("room-mode-badge"),
    roomCodeDisplay: document.getElementById("room-code-display"),
    mapVoteCards: document.getElementById("map-vote-cards"),
    seriesScoreBadge: document.getElementById("room-series-score"),
    teamAList: document.getElementById("team-a-list"),
    teamBList: document.getElementById("team-b-list"),
    teamACount: document.getElementById("team-a-count"),
    teamBCount: document.getElementById("team-b-count"),
    btnJoinA: document.getElementById("btn-join-a"),
    btnJoinB: document.getElementById("btn-join-b"),
    roomPlayerCount: document.getElementById("room-player-count"),
    roomMaxCount: document.getElementById("room-max-count"),
    chatMessages: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    roomList: document.getElementById("room-list"),
    countdownNum: document.getElementById("countdown-num"),
    btnReady: document.getElementById("btn-ready"),
    btnHostStart: document.getElementById("btn-host-start"),
    btnLeaveRoom: document.getElementById("btn-leave-room"),
    btnJoinCode: document.getElementById("btn-join-code"),
    joinCodeInput: document.getElementById("join-code-input"),
    btnBrowse: document.getElementById("btn-browse"),
    btnRefreshRooms: document.getElementById("btn-refresh-rooms"),
    btnBackBrowse: document.getElementById("btn-back-browse"),
    btnCancelQueue: document.getElementById("btn-cancel-queue"),
    btnCopyCode: document.getElementById("btn-copy-code"),
    btnSendChat: document.getElementById("btn-send-chat"),
    toast: document.getElementById("toast"),
    // Game end overlay
    overlayEnd: document.getElementById("overlay-end"),
    endTrophy: document.getElementById("end-trophy"),
    endTitle: document.getElementById("end-title"),
    endScoreboard: document.getElementById("end-scoreboard"),
    btnPlayAgain: document.getElementById("btn-play-again"),
    btnEndLobby: document.getElementById("btn-end-lobby"),
    // HUD
    mpHud: document.getElementById("mp-hud"),
    hudPlayers: document.getElementById("hud-players"),
    hudLatency: document.getElementById("hud-latency"),
    btnLeaveMatch: document.getElementById("btn-leave-match"),
    // Background canvas
    bgCanvas: document.getElementById("bg-canvas"),
    // Arena (in-match top-down canvas)
    arenaCanvas: document.getElementById("arena-canvas"),
    joystickZone: document.getElementById("arena-joystick-zone"),
    joystickBase: document.getElementById("arena-joystick-base"),
    joystickKnob: document.getElementById("arena-joystick-knob"),
    aimZone: document.getElementById("arena-aim-zone"),
    aimBase: document.getElementById("arena-aim-base"),
    aimKnob: document.getElementById("arena-aim-knob"),
    hpWrap: document.getElementById("arena-hp-wrap"),
    hpFill: document.getElementById("arena-hp-fill"),
    vaultBtn: document.getElementById("arena-vault-btn"),
    phoneBtn: document.getElementById("arena-phone-btn"),
  };

  const state = {
    profile: getProfile(),
    roomState: null,
    queueSize: null,
    queueStartedAt: 0,
    queueTimerId: null,
    ready: false,
  };

  function getProfile() {
    try {
      const user = JSON.parse(localStorage.getItem("cg_current_user"));
      return {
        name: user?.username || "Guest",
        avatar: user?.avatar || "cube",
        photo: user?.photoURL && user.photoURL.startsWith("https://") ? user.photoURL : null,
        evoStage: typeof user?.evoStage === "number" ? user.evoStage : 1,
        badgeIcon: user?.equippedBadgeIcon || null,
      };
    } catch {
      return { name: "Guest", avatar: "cube", evoStage: 1, badgeIcon: null };
    }
  }

  function setScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("active", key === name);
    });
  }

  function showToast(message, type = "success") {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.classList.remove("hidden", "error", "success");
    els.toast.classList.add(type);
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(() => {
      els.toast.classList.add("hidden");
    }, 3000);
  }

  function setConnectStatus(message) {
    if (els.connectStatus) {
      els.connectStatus.innerHTML = `<span class="dot-pulse"></span> ${message}`;
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
    if (now - ARENA.lastShotAt < ARENA.FIRE_COOLDOWN) return;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    dx /= len; dy /= len;

    // Sustained fire climbs the recoil/spread, same idea as a real recoil
    // pattern — a gap of more than half a second resets the streak.
    ARENA.shotStreak = (now - ARENA.lastShotAt < 500) ? ARENA.shotStreak + 1 : 1;
    const streak = Math.min(ARENA.shotStreak, 8);
    ARENA.lastShotAt = now;
    ARENA.gunRecoil = 16 + streak * 3;
    ARENA.shake = Math.min(ARENA.shake + 1.5 + streak * 0.3, 14);
    ARENA.muzzleFlashUntil = now + 70;

    // Bloom: each shot in the streak widens the random spread cone applied
    // to the fired direction, so spraying is punchy but less accurate.
    const spreadRad = (0.006 + streak * 0.009) * (Math.random() * 2 - 1);
    const cos = Math.cos(spreadRad), sin = Math.sin(spreadRad);
    const sdx = dx * cos - dy * sin;
    const sdy = dx * sin + dy * cos;

    window.SOUND?.gunshot(streak);

    ARENA.bullets.push({
      x: ARENA.myPos.x, y: ARENA.myPos.y, dx: sdx, dy: sdy,
      team: MP.myTeam, ownerId: MP.myId, mine: true, dist: 0, elevation: ARENA.elevation,
    });
    MP.sendShoot({ x: ARENA.myPos.x, y: ARENA.myPos.y, dx: sdx, dy: sdy, elevation: ARENA.elevation });
  }

  function formatDuration(ms) {
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  /** "Summon car" ultimate — fires a heavy-hitting car straight ahead.
   *  Gated behind a long cooldown enforced by the server; this is just an
   *  optimistic local check so the button feels responsive, but
   *  'carSummonDenied' (with the server's real remaining time) always wins. */
  function trySummonCar() {
    if (ARENA.dead || !ARENA.running) return;
    const now = Date.now();
    const elapsed = now - ARENA.lastCarSummonAt;
    if (elapsed < CAR_COOLDOWN_MS) {
      showToast(`Car summon on cooldown — ${formatDuration(CAR_COOLDOWN_MS - elapsed)} left`, "error");
      return;
    }
    const f = getForward();
    ARENA.lastCarSummonAt = now;
    ARENA.cars.push({
      x: ARENA.myPos.x, y: ARENA.myPos.y, dx: f.x, dy: f.y,
      team: MP.myTeam, ownerId: MP.myId, mine: true, dist: 0, elevation: ARENA.elevation,
    });
    MP.summonCar({ x: ARENA.myPos.x, y: ARENA.myPos.y, dx: f.x, dy: f.y, elevation: ARENA.elevation });
    showToast("Car summoned!", "success");
  }

  function createJoystick(zone, base, knob, radius, onMove, onEnd) {
    if (!zone || !base || !knob) return;
    let originX = 0, originY = 0;

    function start(e) {
      if (!ARENA.running) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      originX = t.clientX; originY = t.clientY;
      base.style.left = `${originX - 55}px`;
      base.style.top  = `${originY - 55}px`;
      base.classList.add("active");
      e.preventDefault();
    }
    function move(e) {
      if (!base.classList.contains("active")) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      let dx = t.clientX - originX, dy = t.clientY - originY;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) { dx = dx / dist * radius; dy = dy / dist * radius; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onMove(dx / radius, dy / radius);
      e.preventDefault();
    }
    function end() {
      knob.style.transform = "translate(0,0)";
      base.classList.remove("active");
      onEnd();
    }

    zone.addEventListener("touchstart", start, { passive: false });
    zone.addEventListener("touchmove", move, { passive: false });
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);
  }

  function initArenaControls() {
    window.addEventListener("resize", resizeArenaCanvas);

    window.addEventListener("keydown", e => {
      if (!ARENA.running) return;
      if (["w","W","ArrowUp"].includes(e.key)) ARENA.keys.up = true;
      else if (["s","S","ArrowDown"].includes(e.key)) ARENA.keys.down = true;
      else if (["a","A","ArrowLeft"].includes(e.key)) ARENA.keys.left = true;
      else if (["d","D","ArrowRight"].includes(e.key)) ARENA.keys.right = true;
      else if (e.key === " ") { e.preventDefault(); tryVault(); }
      else if (e.key === "c" || e.key === "C") trySummonCar();
    });
    window.addEventListener("keyup", e => {
      if (["w","W","ArrowUp"].includes(e.key)) ARENA.keys.up = false;
      else if (["s","S","ArrowDown"].includes(e.key)) ARENA.keys.down = false;
      else if (["a","A","ArrowLeft"].includes(e.key)) ARENA.keys.left = false;
      else if (["d","D","ArrowRight"].includes(e.key)) ARENA.keys.right = false;
    });

    // Left joystick — movement
    createJoystick(els.joystickZone, els.joystickBase, els.joystickKnob, 50,
      (x, y) => { ARENA.joy.active = true; ARENA.joy.x = x; ARENA.joy.y = y; },
      () => { ARENA.joy.active = false; ARENA.joy.x = 0; ARENA.joy.y = 0; });

    els.vaultBtn?.addEventListener("touchstart", e => { e.preventDefault(); tryVault(); }, { passive: false });
    els.vaultBtn?.addEventListener("click", () => tryVault());

    els.phoneBtn?.addEventListener("touchstart", e => { e.preventDefault(); trySummonCar(); }, { passive: false });
    els.phoneBtn?.addEventListener("click", () => trySummonCar());

    // Right joystick — look (drag rotates yaw), auto-fires forward while held
    createJoystick(els.aimZone, els.aimBase, els.aimKnob, 50,
      (x, y) => { ARENA.aimJoy.active = true; ARENA.aimJoy.x = x; ARENA.aimJoy.y = y; },
      () => { ARENA.aimJoy.active = false; ARENA.aimJoy.x = 0; ARENA.aimJoy.y = 0; });

    // Desktop: drag on the arena to look around (first-person); a short
    // click (little/no movement) fires forward, same as touch tap-to-fire.
    els.arenaCanvas?.addEventListener("mousedown", e => {
      if (!ARENA.running || isTouchDevice()) return;
      ARENA.dragging = true;
      ARENA.lastDragX = e.clientX;
      ARENA.dragMoved = 0;
      e.preventDefault();
    });
    window.addEventListener("mousemove", e => {
      if (!ARENA.dragging) return;
      const dx = e.clientX - ARENA.lastDragX;
      ARENA.lastDragX = e.clientX;
      ARENA.dragMoved += Math.abs(dx);
      ARENA.yaw += dx * 0.0035;
    });
    window.addEventListener("mouseup", () => {
      if (!ARENA.dragging) return;
      ARENA.dragging = false;
      if (ARENA.dragMoved < 8) {
        const f = getForward();
        fireShot(f.x, f.y);
      }
    });

    // Touch: drag directly on the arena canvas (outside the joystick zones)
    // also looks around + tap-to-fire, same pattern as desktop.
    els.arenaCanvas?.addEventListener("touchstart", e => {
      if (!ARENA.running) return;
      const t = e.touches[0];
      ARENA.dragging = true;
      ARENA.lastDragX = t.clientX;
      ARENA.dragMoved = 0;
    }, { passive: true });
    els.arenaCanvas?.addEventListener("touchmove", e => {
      if (!ARENA.dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - ARENA.lastDragX;
      ARENA.lastDragX = t.clientX;
      ARENA.dragMoved += Math.abs(dx);
      ARENA.yaw += dx * 0.0035;
    }, { passive: true });
    els.arenaCanvas?.addEventListener("touchend", e => {
      if (!ARENA.dragging) return;
      ARENA.dragging = false;
      if (ARENA.dragMoved < 8) {
        const f = getForward();
        fireShot(f.x, f.y);
      }
    });
  }

  function showArena() {
    if (!els.arenaCanvas) return;
    resizeArenaCanvas();
    els.arenaCanvas.classList.remove("hidden");
    els.hpWrap?.classList.remove("hidden");
    if (isTouchDevice()) {
      els.joystickZone?.classList.remove("hidden");
      els.aimZone?.classList.remove("hidden");
      els.vaultBtn?.classList.remove("hidden");
      els.phoneBtn?.classList.remove("hidden");
    }
  }

  function hideArena() {
    if (els.arenaCanvas) els.arenaCanvas.classList.add("hidden");
    els.hpWrap?.classList.add("hidden");
    els.vaultBtn?.classList.add("hidden");
    els.phoneBtn?.classList.add("hidden");
    if (els.joystickZone) {
      els.joystickZone.classList.add("hidden");
      els.joystickBase?.classList.remove("active");
    }
    if (els.aimZone) {
      els.aimZone.classList.add("hidden");
      els.aimBase?.classList.remove("active");
    }
  }

  function setHp(hp) {
    ARENA.hp = clamp(hp, 0, ARENA.MAX_HP);
    if (els.hpFill) {
      els.hpFill.style.width = `${(ARENA.hp / ARENA.MAX_HP) * 100}%`;
      els.hpFill.style.background = ARENA.hp > ARENA.MAX_HP * 0.4 ? "var(--coop)" : "var(--versus)";
    }
  }

  function startArenaLoop() {
    if (!els.arenaCanvas) return;
    ARENA.ctx = els.arenaCanvas.getContext("2d");
    ARENA.running = true;
    ARENA.myPos = { x: 0, y: 0 };
    ARENA.yaw = 0;
    ARENA.bullets = [];
    ARENA.cars = [];
    ARENA.dead = false;
    ARENA.elevation = 0;
    ARENA.onTopId = null;
    ARENA.vault = null;
    setHp(ARENA.MAX_HP);
    ARENA.lastFrame = performance.now();

    function frame(now) {
      if (!ARENA.running) return;
      try {
        runFrame(now);
      } catch (err) {
        console.error("Arena frame error (recovered, loop continues):", err);
      }
      ARENA.rafId = requestAnimationFrame(frame);
    }

    function runFrame(now) {
      const dt = Math.min((now - ARENA.lastFrame) / 1000, 0.1);
      ARENA.lastFrame = now;

      if (!ARENA.dead) {
        // Movement — relative to which way we're facing (first-person)
        let mForward = 0, mStrafe = 0;
        if (ARENA.joy.active) {
          mStrafe = ARENA.joy.x; mForward = -ARENA.joy.y;
        } else {
          if (ARENA.keys.up) mForward += 1;
          if (ARENA.keys.down) mForward -= 1;
          if (ARENA.keys.left) mStrafe -= 1;
          if (ARENA.keys.right) mStrafe += 1;
          const mag = Math.hypot(mForward, mStrafe);
          if (mag > 1) { mForward /= mag; mStrafe /= mag; }
        }
        const fwd = getForward(), right = getRight();
        const vx = fwd.x * mForward + right.x * mStrafe;
        const vy = fwd.y * mForward + right.y * mStrafe;
        let nx = clamp(ARENA.myPos.x + vx * ARENA.SPEED * dt, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);
        let ny = clamp(ARENA.myPos.y + vy * ARENA.SPEED * dt, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);
        const resolved = resolveObstacleCollision(nx, ny, ARENA.elevation);
        ARENA.myPos.x = clamp(resolved.x, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);
        ARENA.myPos.y = clamp(resolved.y, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);

        updateElevation(dt);

        // Reconciliation — if the server rejected a recent move (e.g. a lag
        // spike briefly looked like a teleport), gently pull our locally
        // predicted position back toward the authoritative one instead of
        // teleporting instantly, so it doesn't feel jarring.
        if (ARENA.correctionTarget) {
          const cdx = ARENA.correctionTarget.x - ARENA.myPos.x;
          const cdy = ARENA.correctionTarget.y - ARENA.myPos.y;
          if (Math.hypot(cdx, cdy) < 0.5) {
            ARENA.correctionTarget = null;
          } else {
            const pull = 1 - Math.pow(0.001, dt); // framerate-independent ~exponential ease
            ARENA.myPos.x += cdx * pull;
            ARENA.myPos.y += cdy * pull;
          }
        }

        // Position-only — omits velocity so the server's optional speed
        // check never applies; deltas per send are already small/clamped.
        MP.updateMyState({ position: { x: ARENA.myPos.x, y: ARENA.myPos.y }, yaw: ARENA.yaw, elevation: ARENA.elevation });

        // Aim-stick: dragging it rotates the view, and holding it fires
        // forward — the touch equivalent of mouse-drag-to-look.
        if (ARENA.aimJoy.active) {
          ARENA.yaw += ARENA.aimJoy.x * ARENA.TURN_SPEED * dt;
          const f = getForward();
          fireShot(f.x, f.y);
        }
      }

      ARENA.gunRecoil = Math.max(0, ARENA.gunRecoil - 90 * dt);
      ARENA.shake = Math.max(0, ARENA.shake - 40 * dt);
      updateBullets(dt);
      updateCars(dt);
      drawArena();
    }
    ARENA.rafId = requestAnimationFrame(frame);
  }

  function stopArenaLoop() {
    ARENA.running = false;
    if (ARENA.rafId) cancelAnimationFrame(ARENA.rafId);
    ARENA.rafId = null;
    ARENA.keys = { up: false, down: false, left: false, right: false };
    ARENA.joy = { active: false, x: 0, y: 0 };
    ARENA.aimJoy = { active: false, x: 0, y: 0 };
    ARENA.dragging = false;
    ARENA.bullets = [];
  }

  /** Spawn a bullet fired by someone else, relayed through the server. */
  function spawnRemoteBullet(d) {
    if (d.playerId === MP.myId) return;
    ARENA.bullets.push({
      x: d.x, y: d.y, dx: d.dx, dy: d.dy,
      team: d.team, ownerId: d.playerId, mine: false, dist: 0, elevation: d.elevation || 0,
    });
  }

  /** Is a point blocked by an obstacle, given the elevation of whatever is
   *  passing through it (a bullet, typically)? Walls always block; crates
   *  only block things below their top. */
  function obstacleBlocksAt(x, y, elevation) {
    for (const obs of getObstacles()) {
      if (!insideFootprint(obs, x, y)) continue;
      if (obs.type === "wall") return true;
      if (elevation < obs.h - 2) return true;
    }
    return false;
  }

  /** Like obstacleBlocksAt, but only walls count — used by the car ultimate,
   *  which is heavy enough to just smash through crates. */
  function wallBlocksAt(x, y) {
    for (const obs of getObstacles()) {
      if (obs.type === "wall" && insideFootprint(obs, x, y)) return true;
    }
    return false;
  }

  function updateBullets(dt) {
    const step = ARENA.BULLET_SPEED * dt;
    ARENA.bullets = ARENA.bullets.filter(b => {
      b.x += b.dx * step;
      b.y += b.dy * step;
      b.dist += step;
      if (b.dist > ARENA.BULLET_RANGE) return false;
      if (Math.abs(b.x) > ARENA.WORLD_HALF || Math.abs(b.y) > ARENA.WORLD_HALF) return false;
      if (obstacleBlocksAt(b.x, b.y, b.elevation || 0)) return false; // stopped by cover

      // Only bullets fired by someone else can hit me, and only if I'm alive.
      if (!b.mine && !ARENA.dead && b.team !== MP.myTeam) {
        const dist = Math.hypot(b.x - ARENA.myPos.x, b.y - ARENA.myPos.y);
        if (dist <= ARENA.HIT_RADIUS) {
          registerLocalHit();
          return false; // bullet consumed
        }
      }

      // My own bullets: purely cosmetic hit-marker feedback for the shooter.
      // The server is the actual authority on damage (see remoteHealth) —
      // this is just instant feedback instead of waiting on the round trip.
      if (b.mine) {
        for (const p of MP.opponents()) {
          const remote = MP.remotePlayers.get(p.id);
          if (remote?.state?.alive === false) continue;
          const pos = MP.getInterpolatedPosition(p.id);
          if (!pos) continue;
          if (Math.hypot(b.x - pos.x, b.y - pos.y) <= ARENA.HIT_RADIUS) {
            registerHitMarker();
            return false; // bullet consumed on cosmetic hit
          }
        }
      }
      return true;
    });
  }

  /** Same idea as updateBullets, for the summon-car ultimate: bigger, faster,
   *  fixed 100 damage, and only stopped by walls (crates get run over). */
  function updateCars(dt) {
    const step = CAR_SPEED * dt;
    ARENA.cars = ARENA.cars.filter(c => {
      c.x += c.dx * step;
      c.y += c.dy * step;
      c.dist += step;
      if (c.dist > CAR_RANGE) return false;
      if (Math.abs(c.x) > ARENA.WORLD_HALF * 1.6 || Math.abs(c.y) > ARENA.WORLD_HALF * 1.6) return false;
      if (wallBlocksAt(c.x, c.y)) return false; // stopped by a wall (crates don't stop it)

      if (!c.mine && !ARENA.dead && c.team !== MP.myTeam) {
        if (Math.hypot(c.x - ARENA.myPos.x, c.y - ARENA.myPos.y) <= CAR_HIT_RADIUS) {
          registerLocalHit();
          return false;
        }
      }

      if (c.mine) {
        for (const p of MP.opponents()) {
          const remote = MP.remotePlayers.get(p.id);
          if (remote?.state?.alive === false) continue;
          const pos = MP.getInterpolatedPosition(p.id);
          if (!pos) continue;
          if (Math.hypot(c.x - pos.x, c.y - pos.y) <= CAR_HIT_RADIUS) {
            registerHitMarker();
            return false;
          }
        }
      }
      return true;
    });
  }

  function registerHitMarker() {
    ARENA.hitMarkerUntil = performance.now() + 220;
    ARENA.shake = Math.min(ARENA.shake + 2, 14);
    window.SOUND?.hitMarker();
  }

  // Cosmetic-only immediate feedback for getting hit — the server is now the
  // authority on actual HP (see the 'remoteHealth' listener in wireEvents,
  // which calls applyAuthoritativeHp for MP.myId). This just gives instant
  // shake/flash/sound instead of waiting on the round trip.
  function registerLocalHit() {
    ARENA.hurtFlashUntil = performance.now() + 260;
    ARENA.shake = Math.min(ARENA.shake + 5, 14);
    window.SOUND?.hurt();
  }

  /** Called when the server tells us our authoritative HP (Phase 3
   *  server-side hit detection) — this is the only place that actually
   *  changes ARENA.hp / triggers death now. */
  function applyAuthoritativeHp(hp) {
    const prevHp = ARENA.hp;
    setHp(hp);
    if (hp < prevHp) {
      ARENA.hurtFlashUntil = performance.now() + 260;
      ARENA.shake = Math.min(ARENA.shake + 5, 14);
    }
    if (ARENA.hp <= 0 && !ARENA.dead) {
      ARENA.dead = true;
      showToast("You were eliminated", "error");
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Project a world point into {d: forward distance, r: right offset} relative to the camera. */
  function toCameraSpace(ox, oy) {
    const relX = ox - ARENA.myPos.x, relY = oy - ARENA.myPos.y;
    const fwd = getForward(), right = getRight();
    return { d: relX * fwd.x + relY * fwd.y, r: relX * right.x + relY * right.y };
  }

  function drawGun(ctx, w, h) {
    const bx = w * 0.70, by = h + 6 + ARENA.gunRecoil * 0.6;
    ctx.save();
    ctx.translate(bx, by);

    // Body/slide
    const grad = ctx.createLinearGradient(0, -110, 0, 0);
    grad.addColorStop(0, "#4a5162");
    grad.addColorStop(1, "#14161c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.lineTo(-70, -80);
    ctx.lineTo(15, -80);
    ctx.lineTo(40, -112);
    ctx.lineTo(130, -112);
    ctx.lineTo(130, -70);
    ctx.lineTo(65, -70);
    ctx.lineTo(65, 0);
    ctx.closePath();
    ctx.fill();

    // Grip
    ctx.fillStyle = "#0d0e12";
    roundRect(ctx, -58, -22, 46, 70, 6);
    ctx.fill();

    // Muzzle flash
    if (performance.now() < ARENA.muzzleFlashUntil) {
      ctx.fillStyle = "rgba(255,220,120,0.9)";
      ctx.beginPath();
      ctx.arc(128, -95, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(128, -95, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawArena() {
    const ctx = ARENA.ctx, canvas = els.arenaCanvas;
    if (!ctx || !canvas) return;
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const horizon = h * 0.44;
    const fov = w * 0.62;

    ctx.clearRect(0, 0, w, h);

    // Screen shake — small random jitter, isolated with save/restore so it
    // doesn't accumulate across frames.
    ctx.save();
    if (ARENA.shake > 0.05) {
      const sx = (Math.random() * 2 - 1) * ARENA.shake;
      const sy = (Math.random() * 2 - 1) * ARENA.shake;
      ctx.translate(sx, sy);
    }

    const activeMap = ARENA.map || DEFAULT_MAP;
    // Camera height cue — how high we currently are (from climbing a crate).
    // We don't have real camera pitch, so instead of moving the horizon
    // (which nothing else agreed with), every object gets its *own* small
    // vertical offset based on its elevation relative to ours. Ground-level
    // things (elevation 0) offset the same amount either way, so this stays
    // consistent between bullets, players, and obstacles.
    const camElevation = ARENA.elevation || 0;
    function elevOffset(objElevation, scale) {
      return clamp((objElevation - camElevation) * scale * 0.35, -h * 0.3, h * 0.3);
    }

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, activeMap.sky[0]);
    sky.addColorStop(1, activeMap.sky[1]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, horizon);

    // Floor
    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, activeMap.floor[0]);
    floor.addColorStop(1, activeMap.floor[1]);
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);

    // Receding depth lines (cheap perspective grid cue)
    ctx.strokeStyle = activeMap.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -5; i <= 5; i++) {
      ctx.moveTo(cx, horizon);
      ctx.lineTo(cx + i * (w / 8), h);
    }
    ctx.stroke();

    // Bullets — drawn as short fading tracers rather than static dots
    ARENA.bullets.forEach(b => {
      const { d, r } = toCameraSpace(b.x, b.y);
      if (d <= 2) return;
      const scale = fov / d;
      const sx = cx + r * scale;
      const sy = horizon + (h - horizon) * clamp(1 - d / ARENA.BULLET_RANGE, 0.08, 0.85) - elevOffset(b.elevation || 0, scale);
      const size = clamp(scale * 0.06, 1.5, 8);

      // Tail point: slightly behind the bullet along its travel direction.
      const { d: dTail, r: rTail } = toCameraSpace(b.x - b.dx * 14, b.y - b.dy * 14);
      const tailScale = fov / Math.max(dTail, 2);
      const tsx = cx + rTail * tailScale;
      const tsy = horizon + (h - horizon) * clamp(1 - dTail / ARENA.BULLET_RANGE, 0.08, 0.85) - elevOffset(b.elevation || 0, tailScale);

      const color = b.team === "A" ? "#00e5a0" : "#ff4466";
      const grad = ctx.createLinearGradient(tsx, tsy, sx, sy);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, color);
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1.5, size * 0.7);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tsx, tsy);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // World objects (obstacles + other players), far-to-near so nearer ones
    // draw on top and correctly occlude anything behind them.
    const renderList = [];
    getObstacles().forEach(obs => {
      const { d, r } = toCameraSpace(obs.x, obs.y);
      if (d <= 1) return; // behind camera / on top of us
      renderList.push({ kind: "obstacle", obs, d, r });
    });
    ARENA.cars.forEach(c => {
      const { d, r } = toCameraSpace(c.x, c.y);
      if (d <= 1) return;
      renderList.push({ kind: "car", car: c, d, r });
    });
    MP.allPlayers().forEach(p => {
      if (p.id === MP.myId) return; // first-person: don't render self
      const remote = MP.remotePlayers.get(p.id);
      const pos = MP.getInterpolatedPosition(p.id) || remote?.state?.position || { x: 0, y: 0 };
      const hp = typeof remote?.state?.hp === "number" ? remote.state.hp : (p.hp ?? ARENA.MAX_HP);
      const isDead = remote?.state?.alive === false || !p.alive;
      const elevation = typeof remote?.state?.elevation === "number" ? remote.state.elevation : 0;
      const { d, r } = toCameraSpace(pos.x, pos.y);
      if (d <= 2) return;
      renderList.push({ kind: "player", p, hp, isDead, elevation, d, r });
    });
    renderList.sort((a, b) => b.d - a.d);

    renderList.forEach(entry => {
      const { d, r } = entry;
      const scale = fov / d;
      const sx = cx + r * scale;

      if (entry.kind === "obstacle") {
        const obs = entry.obs;
        const boxH = clamp(scale * (obs.h / 60), 8, h * 0.9);
        const boxW = clamp(scale * ((obs.hw + obs.hy) / 1.2), 10, w * 0.5);
        // Obstacles sit at ground level (elevation 0) — offset the same way
        // a ground-level player would be.
        const sy = horizon + Math.min(boxH * 0.35, (h - horizon) * 0.6) - elevOffset(0, scale);
        const baseColor = obs.type === "wall" ? "#3a3f52" : (activeMap.accent || "#7b6cff");
        const grad = ctx.createLinearGradient(0, sy - boxH, 0, sy);
        grad.addColorStop(0, baseColor);
        grad.addColorStop(1, "rgba(10,11,18,0.9)");
        ctx.fillStyle = grad;
        roundRect(ctx, sx - boxW / 2, sy - boxH, boxW, boxH, Math.min(6, boxW * 0.15));
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        return;
      }

      if (entry.kind === "car") {
        const c = entry.car;
        const boxH = clamp(scale * 0.9, 14, h * 0.7);
        const boxW = clamp(scale * 1.6, 20, w * 0.6);
        const sy = horizon + Math.min(boxH * 0.35, (h - horizon) * 0.6) - elevOffset(c.elevation || 0, scale);
        const color = c.team === "A" ? "#00e5a0" : "#ff4466";
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = "#1a1d2b";
        roundRect(ctx, sx - boxW / 2, sy - boxH, boxW, boxH, boxW * 0.12);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        return;
      }

      const { p, hp, isDead, elevation } = entry;
      const bodyH = clamp(scale * 1.15, 10, h * 0.62);
      const bodyW = bodyH * 0.42;
      // Raise/lower on screen based on their elevation relative to ours —
      // an approximation of height, not a true 3D projection.
      const sy = horizon + Math.min(bodyH * 0.35, (h - horizon) * 0.55) - elevOffset(elevation, scale);
      const color = p.team === "A" ? "#00e5a0" : "#ff4466";

      ctx.globalAlpha = isDead ? 0.22 : 1;
      ctx.fillStyle = color;
      roundRect(ctx, sx - bodyW / 2, sy - bodyH, bodyW, bodyH, bodyW * 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (!isDead) {
        const barW = Math.max(24, bodyW);
        ctx.fillStyle = "rgba(20,23,40,.85)";
        ctx.fillRect(sx - barW / 2, sy - bodyH - 14, barW, 4);
        ctx.fillStyle = hp > ARENA.MAX_HP * 0.4 ? "#00e5a0" : "#ff4466";
        ctx.fillRect(sx - barW / 2, sy - bodyH - 14, barW * clamp(hp, 0, ARENA.MAX_HP) / ARENA.MAX_HP, 4);
      }

      ctx.font = `${clamp(scale * 0.22, 10, 15)}px 'Rajdhani', sans-serif`;
      ctx.fillStyle = "#e8ecff";
      ctx.textAlign = "center";
      ctx.fillText(p.name || "Player", sx, sy - bodyH - 18);
    });

    ctx.restore(); // end screen-shake — crosshair/gun/HUD stay steady

    // Crosshair — swaps to a hit-marker X briefly after a confirmed hit
    const now = performance.now();
    const showingHitMarker = now < ARENA.hitMarkerUntil;
    ctx.strokeStyle = showingHitMarker ? "#ffd84d" : "rgba(255,255,255,0.85)";
    ctx.lineWidth = showingHitMarker ? 3 : 2;
    ctx.beginPath();
    if (showingHitMarker) {
      ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
      ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
    } else {
      ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 3, cy);
      ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 9, cy);
      ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy - 3);
      ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 9);
    }
    ctx.stroke();

    drawGun(ctx, w, h);

    // Hurt vignette — brief red pulse around the screen edges when hit
    if (now < ARENA.hurtFlashUntil) {
      const remaining = (ARENA.hurtFlashUntil - now) / 260;
      const vignette = ctx.createRadialGradient(cx, cy, h * 0.25, cx, cy, h * 0.75);
      vignette.addColorStop(0, "rgba(255,68,102,0)");
      vignette.addColorStop(1, `rgba(255,68,102,${0.35 * remaining})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function renderHud() {
    if (!els.hudPlayers || !state.roomState) return;
    els.hudPlayers.innerHTML = "";
    MP.allPlayers().forEach(player => {
      const remote = MP.remotePlayers.get(player.id);
      const isMe = player.id === MP.myId;
      const isDead = isMe ? ARENA.dead : (remote?.state?.alive === false || !player.alive);
      const pill = document.createElement("div");
      pill.className = "hud-player-pill";
      if (isMe) pill.classList.add("me");
      if (isDead) pill.classList.add("dead");
      pill.innerHTML = `<span>[${player.team}]</span><span>${evoIcon(player.evoStage)}</span><span>${player.name}</span><span style="color:var(--gold)">${player.score ?? 0}</span>`;
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
