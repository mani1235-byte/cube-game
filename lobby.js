// lobby.js
// Client-side controller for lobby.html.
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
    playerList: document.getElementById("player-list"),
    roomPlayerCount: document.getElementById("room-player-count"),
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
    // Background canvas
    bgCanvas: document.getElementById("bg-canvas"),
  };

  const state = {
    profile: getProfile(),
    roomState: null,
    queueMode: null,
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
      };
    } catch {
      return { name: "Guest", avatar: "cube", evoStage: 1 };
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
    if (els.badgeName) els.badgeName.textContent = state.profile.name;
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

  function formatMode(mode) {
    return String(mode || "versus").toUpperCase();
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
    name.textContent = player.name || "Unknown";

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
    ].filter(Boolean).join(" • ") || "PLAYING";

    item.append(evo, info, status);
    return item;
  }

  function renderPlayers(roomState) {
    if (!roomState || !els.playerList) return;

    clearNode(els.playerList);
    if (els.roomPlayerCount) {
      els.roomPlayerCount.textContent = String(roomState.players?.length || 0);
    }
    if (els.roomModeBadge) {
      els.roomModeBadge.textContent = formatMode(roomState.mode);
      els.roomModeBadge.classList.toggle("coop", roomState.mode === "coop");
    }
    if (els.roomCodeDisplay) {
      els.roomCodeDisplay.textContent = roomState.code || "------";
    }
    if (els.btnHostStart) {
      els.btnHostStart.classList.toggle("hidden", !MP.isHost);
    }

    (roomState.players || []).forEach(player => {
      els.playerList.appendChild(createPlayerRow(roomState, player));
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
    name.textContent = `${msg.name || "Unknown"}:`;

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
    mode.textContent = formatMode(room.mode);

    const host = document.createElement("div");
    host.className = "rli-host";
    host.textContent = room.host || "Unknown";

    const count = document.createElement("div");
    count.className = "rli-count";
    count.textContent = `${room.playerCount}/${room.maxPlayers}`;

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

  async function joinRoom(code) {
    const cleaned = String(code || els.joinCodeInput?.value || "").trim().toUpperCase();
    if (!cleaned) {
      showToast("Enter a room code first", "error");
      return;
    }

    try {
      await MP.joinRoom(cleaned, state.profile);
      setScreen("room");
      showToast(`Joined room ${cleaned}`, "success");
    } catch (err) {
      showToast(err || "Could not join room", "error");
    }
  }

  async function createRoom(mode) {
    try {
      await MP.createRoom(mode, state.profile);
      setScreen("room");
      setReadyButton(false);
      showToast(`Created ${formatMode(mode)} room`, "success");
    } catch (err) {
      showToast(err || "Could not create room", "error");
    }
  }

  function joinQueue(mode) {
    if (!MP.connected) {
      showToast("Connecting to server…", "error");
      return;
    }
    state.queueMode = mode;
    MP.joinQueue(mode, state.profile);
    setScreen("queue");
    if (els.queueTitle) {
      els.queueTitle.textContent = mode === "coop" ? "Finding Co-op Match…" : "Finding VS Match…";
    }
    if (els.queueSub) els.queueSub.textContent = "Position 1 in queue";
    startQueueTimer();
  }

  function leaveQueue() {
    MP.leaveQueue();
    stopQueueTimer();
    state.queueMode = null;
    setScreen("home");
  }

  function leaveRoom() {
    MP.leaveRoom();
    state.roomState = null;
    setReadyButton(false);
    stopQueueTimer();
    setScreen("home");
  }

  function showEndOverlay(data) {
    if (!els.overlayEnd) return;

    // Hide HUD
    if (els.mpHud) els.mpHud.classList.add("hidden");

    // Trophy & title
    const isWinner = data.winner === MP.myId;
    if (els.endTrophy) els.endTrophy.textContent = isWinner ? "🏆" : (data.mode === "coop" ? "💀" : "😔");
    if (els.endTitle) {
      if (data.mode === "coop") {
        els.endTitle.textContent = data.winner ? "SURVIVED!" : "GAME OVER";
      } else {
        els.endTitle.textContent = isWinner ? "VICTORY!" : "DEFEATED";
      }
    }

    // Scoreboard
    if (els.endScoreboard) {
      els.endScoreboard.innerHTML = "";
      (data.scores || []).forEach((entry, i) => {
        const row = document.createElement("div");
        row.className = "score-row";
        if (entry.id === data.winner) row.classList.add("winner");
        row.innerHTML = `
          <span class="score-rank">#${i + 1}</span>
          <span class="score-name">${entry.name || "Unknown"}${entry.id === MP.myId ? " (you)" : ""}</span>
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
    renderPlayers(roomState);
    setScreen("room");
  }

  function handleCountdown(data) {
    setScreen("countdown");
    if (els.countdownNum) els.countdownNum.textContent = String(data?.count ?? 3);
  }

  function handleGameStart() {
    showToast("Game starting!", "success");
    // Hide all lobby screens; the game canvas takes over
    Object.values(screens).forEach(el => el?.classList.remove("active"));
    if (els.overlayEnd) els.overlayEnd.classList.add("hidden");
    if (els.mpHud) {
      els.mpHud.classList.remove("hidden");
      renderHud();
    }
  }

  function renderHud() {
    if (!els.hudPlayers || !state.roomState) return;
    els.hudPlayers.innerHTML = "";
    (state.roomState.players || []).forEach(player => {
      const pill = document.createElement("div");
      pill.className = "hud-player-pill";
      if (player.id === MP.myId) pill.classList.add("me");
      if (!player.alive) pill.classList.add("dead");
      pill.innerHTML = `<span>${evoIcon(player.evoStage)}</span><span>${player.name}</span><span style="color:var(--gold)">${player.score ?? 0}</span>`;
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
      setConnectStatus("Disconnected. Reconnecting…");
      setScreen("connect");
    });

    MP.on("serverError", (err) => {
      showToast(err?.message || "Server error", "error");
    });

    MP.on("queueStatus", (data) => {
      if (els.queuePos) els.queuePos.textContent = String(data?.position || 1);
      if (els.queueSub) els.queueSub.textContent = `Position ${data?.position || 1} in queue`;
      if (els.queueCount) els.queueCount.textContent = `${data?.position || 1} in queue`;
      if (!state.queueStartedAt) startQueueTimer();
      setScreen("queue");
    });

    MP.on("matchFound", (data) => {
      stopQueueTimer();
      showToast(`Match found in ${data?.code || "room"}`, "success");
    });

    MP.on("roomState", handleRoomState);
    MP.on("playerJoined", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
      if (data?.player) {
        renderChatMessage({ system: true, message: `${data.player.name} joined the room.` });
      }
    });
    MP.on("playerLeft", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
      const leftPlayer = state.roomState?.players ? null : data.playerId;
      if (data?.playerId) {
        renderChatMessage({ system: true, message: `A player left the room.` });
      }
    });
    MP.on("playerReady", (data) => {
      if (data?.roomState) handleRoomState(data.roomState);
    });
    MP.on("hostChanged", () => {
      if (state.roomState) renderPlayers(state.roomState);
      renderChatMessage({ system: true, message: "Host has changed." });
    });
    MP.on("chat", renderChatMessage);
    MP.on("countdown", handleCountdown);
    MP.on("gameStart", handleGameStart);
    MP.on("remoteState", () => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
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
    document.querySelectorAll(".mode-card .btn-mode[data-action='queue']").forEach(btn => {
      btn.addEventListener("click", () => joinQueue(btn.dataset.mode));
    });

    document.querySelectorAll(".mode-card .btn-mode[data-action='create']").forEach(btn => {
      btn.addEventListener("click", () => createRoom(btn.dataset.mode));
    });

    els.btnJoinCode?.addEventListener("click", () => joinRoom());
    els.joinCodeInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") joinRoom();
    });

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

    els.btnCopyCode?.addEventListener("click", async () => {
      const code = state.roomState?.code || els.roomCodeDisplay?.textContent || "";
      if (!code || code === "------") return;
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
