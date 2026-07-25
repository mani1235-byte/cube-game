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

  function createPlayerRow(roomState, player) {
    const item = document.createElement("div");
    item.className = "player-item";
    if (player.id === MP.myId) item.classList.add("is-me");
    if (player.ready) item.classList.add("is-ready");

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

    const avatar = document.createElement("span");
    avatar.textContent = player.avatar || "cube";

    const ping = document.createElement("span");
    ping.textContent = player.ping ? `${player.ping} ms` : "-- ms";

    meta.append(avatar, ping);
    info.append(name, meta);

    const status = document.createElement("div");
    status.className = "player-status";
    if (player.ready) status.classList.add("ready");
    if (player.id === roomState.hostId) status.classList.add("host");
    status.textContent = [
      player.id === roomState.hostId ? "HOST" : null,
      player.ready ? "READY" : null,
    ].filter(Boolean).join(" • ") || "WAITING";

    item.append(evo, info, status);
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
    setScreen("room");
  }

  function handleCountdown(data) {
    setScreen("countdown");
    if (els.countdownNum) els.countdownNum.textContent = String(data?.count ?? 3);
  }

  function handleGameStart() {
    showToast("Game starting!", "success");
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
    DAMAGE: 12,
    FIRE_COOLDOWN: 220,  // ms between local shots
    running: false,
    ctx: null,
    keys: { up: false, down: false, left: false, right: false },
    joy: { active: false, x: 0, y: 0 },     // -1..1 movement vector
    aimJoy: { active: false, x: 0, y: 0 },  // -1..1 aim vector (mobile)
    myPos: { x: 0, y: 0 },
    hp: 100,
    dead: false,
    bullets: [],         // { x, y, dx, dy, team, ownerId, mine, dist }
    lastShotAt: 0,
    aimPoint: null,      // last mouse position on canvas, for desktop click-to-fire
    lastFrame: 0,
    rafId: null,
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function resizeArenaCanvas() {
    if (!els.arenaCanvas) return;
    els.arenaCanvas.width = window.innerWidth;
    els.arenaCanvas.height = window.innerHeight;
  }

  function isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  }

  function arenaToScreen() {
    const canvas = els.arenaCanvas;
    const w = canvas.width, h = canvas.height;
    const scale = (Math.min(w, h) / (ARENA.WORLD_HALF * 2)) * 0.9;
    const cx = w / 2, cy = h / 2;
    return { scale, cx, cy };
  }

  /** Fire a shot from my current position toward a world-space direction. */
  function fireShot(dx, dy) {
    if (ARENA.dead || !ARENA.running) return;
    const now = performance.now();
    if (now - ARENA.lastShotAt < ARENA.FIRE_COOLDOWN) return;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    dx /= len; dy /= len;
    ARENA.lastShotAt = now;

    ARENA.bullets.push({
      x: ARENA.myPos.x, y: ARENA.myPos.y, dx, dy,
      team: MP.myTeam, ownerId: MP.myId, mine: true, dist: 0,
    });
    MP.sendShoot({ x: ARENA.myPos.x, y: ARENA.myPos.y, dx, dy });
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

    // Right joystick — aim, auto-fires toward the drag direction while held
    createJoystick(els.aimZone, els.aimBase, els.aimKnob, 50,
      (x, y) => { ARENA.aimJoy.active = true; ARENA.aimJoy.x = x; ARENA.aimJoy.y = y; },
      () => { ARENA.aimJoy.active = false; ARENA.aimJoy.x = 0; ARENA.aimJoy.y = 0; });

    // Desktop: click the arena to fire toward the clicked point
    els.arenaCanvas?.addEventListener("mousedown", e => {
      if (!ARENA.running || isTouchDevice()) return;
      const { scale, cx, cy } = arenaToScreen();
      const wx = (e.clientX - cx) / scale, wy = (e.clientY - cy) / scale;
      fireShot(wx - ARENA.myPos.x, wy - ARENA.myPos.y);
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
    }
  }

  function hideArena() {
    if (els.arenaCanvas) els.arenaCanvas.classList.add("hidden");
    els.hpWrap?.classList.add("hidden");
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
    ARENA.hp = clamp(hp, 0, 100);
    if (els.hpFill) {
      els.hpFill.style.width = `${ARENA.hp}%`;
      els.hpFill.style.background = ARENA.hp > 40 ? "var(--coop)" : "var(--versus)";
    }
  }

  function startArenaLoop() {
    if (!els.arenaCanvas) return;
    ARENA.ctx = els.arenaCanvas.getContext("2d");
    ARENA.running = true;
    ARENA.myPos = { x: 0, y: 0 };
    ARENA.bullets = [];
    ARENA.dead = false;
    setHp(100);
    ARENA.lastFrame = performance.now();

    function frame(now) {
      if (!ARENA.running) return;
      const dt = Math.min((now - ARENA.lastFrame) / 1000, 0.1);
      ARENA.lastFrame = now;

      if (!ARENA.dead) {
        // Movement
        let vx = 0, vy = 0;
        if (ARENA.joy.active) {
          vx = ARENA.joy.x; vy = ARENA.joy.y;
        } else {
          if (ARENA.keys.left) vx -= 1;
          if (ARENA.keys.right) vx += 1;
          if (ARENA.keys.up) vy -= 1;
          if (ARENA.keys.down) vy += 1;
          const mag = Math.hypot(vx, vy);
          if (mag > 1) { vx /= mag; vy /= mag; }
        }
        ARENA.myPos.x = clamp(ARENA.myPos.x + vx * ARENA.SPEED * dt, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);
        ARENA.myPos.y = clamp(ARENA.myPos.y + vy * ARENA.SPEED * dt, -ARENA.WORLD_HALF, ARENA.WORLD_HALF);

        // Position-only — omits velocity so the server's optional speed
        // check never applies; deltas per send are already small/clamped.
        MP.updateMyState({ position: { x: ARENA.myPos.x, y: ARENA.myPos.y } });

        // Aim joystick auto-fires while held
        if (ARENA.aimJoy.active) fireShot(ARENA.aimJoy.x, ARENA.aimJoy.y);
      }

      updateBullets(dt);
      drawArena();
      ARENA.rafId = requestAnimationFrame(frame);
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
    ARENA.bullets = [];
  }

  /** Spawn a bullet fired by someone else, relayed through the server. */
  function spawnRemoteBullet(d) {
    if (d.playerId === MP.myId) return;
    ARENA.bullets.push({
      x: d.x, y: d.y, dx: d.dx, dy: d.dy,
      team: d.team, ownerId: d.playerId, mine: false, dist: 0,
    });
  }

  function updateBullets(dt) {
    const step = ARENA.BULLET_SPEED * dt;
    ARENA.bullets = ARENA.bullets.filter(b => {
      b.x += b.dx * step;
      b.y += b.dy * step;
      b.dist += step;
      if (b.dist > ARENA.BULLET_RANGE) return false;
      if (Math.abs(b.x) > ARENA.WORLD_HALF || Math.abs(b.y) > ARENA.WORLD_HALF) return false;

      // Only bullets fired by someone else can hit me, and only if I'm alive.
      if (!b.mine && !ARENA.dead && b.team !== MP.myTeam) {
        const dist = Math.hypot(b.x - ARENA.myPos.x, b.y - ARENA.myPos.y);
        if (dist <= ARENA.HIT_RADIUS) {
          registerLocalHit();
          return false; // bullet consumed
        }
      }
      return true;
    });
  }

  function registerLocalHit() {
    setHp(ARENA.hp - ARENA.DAMAGE);
    MP.sendDamage(ARENA.DAMAGE);
    if (ARENA.hp <= 0 && !ARENA.dead) {
      ARENA.dead = true;
      showToast("You were eliminated", "error");
    }
  }

  function drawArena() {
    const ctx = ARENA.ctx, canvas = els.arenaCanvas;
    if (!ctx || !canvas) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const { scale, cx, cy } = arenaToScreen();
    const toScreen = (wx, wy) => ({ x: cx + wx * scale, y: cy + wy * scale });
    const half = ARENA.WORLD_HALF * scale;

    // Arena boundary
    ctx.strokeStyle = "rgba(123,108,255,.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);

    // Grid
    ctx.strokeStyle = "rgba(100,120,255,.08)";
    ctx.lineWidth = 1;
    const step = 40 * scale;
    for (let x = cx - half; x <= cx + half; x += step) {
      ctx.beginPath(); ctx.moveTo(x, cy - half); ctx.lineTo(x, cy + half); ctx.stroke();
    }
    for (let y = cy - half; y <= cy + half; y += step) {
      ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx + half, y); ctx.stroke();
    }

    // Bullets
    ctx.lineCap = "round";
    ARENA.bullets.forEach(b => {
      const sp = toScreen(b.x, b.y);
      const tail = toScreen(b.x - b.dx * 10, b.y - b.dy * 10);
      ctx.strokeStyle = b.team === "A" ? "#00e5a0" : "#ff4466";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
    });

    // Players
    MP.allPlayers().forEach(p => {
      const isMe = p.id === MP.myId;
      const remote = MP.remotePlayers.get(p.id);
      const pos = isMe ? ARENA.myPos : (remote?.state?.position || { x: 0, y: 0 });
      const hp = isMe ? ARENA.hp : (typeof remote?.state?.hp === "number" ? remote.state.hp : (p.hp ?? 100));
      const isDead = isMe ? ARENA.dead : (remote?.state?.alive === false || !p.alive);
      const sp = toScreen(pos.x, pos.y);
      const color = p.team === "A" ? "#00e5a0" : "#ff4466";

      ctx.globalAlpha = isDead ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, isMe ? 14 : 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (isMe) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // HP bar over the head
      if (!isDead) {
        const barW = 28;
        ctx.fillStyle = "rgba(20,23,40,.8)";
        ctx.fillRect(sp.x - barW / 2, sp.y - 30, barW, 4);
        ctx.fillStyle = hp > 40 ? "#00e5a0" : "#ff4466";
        ctx.fillRect(sp.x - barW / 2, sp.y - 30, barW * clamp(hp, 0, 100) / 100, 4);
      }

      ctx.font = "12px 'Rajdhani', sans-serif";
      ctx.fillStyle = "#e8ecff";
      ctx.textAlign = "center";
      ctx.fillText(p.name || "Player", sp.x, sp.y - 36);
    });
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
    MP.on("countdown", handleCountdown);
    MP.on("gameStart", handleGameStart);
    MP.on("remoteState", () => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("remoteShoot", spawnRemoteBullet);
    MP.on("remoteHealth", () => {
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
      hideEndOverlay();
      if (MP.inRoom) {
        setReadyButton(false);
        setScreen("room");
      } else {
        setScreen("home");
      }
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
