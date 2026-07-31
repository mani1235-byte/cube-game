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

  // ── Core DOM refs, state, and screen switching ────────────────────────────
  // Every id below must match lobby.html exactly.
  const els = {
    bgCanvas:         document.getElementById("bg-canvas"),
    badgeName:        document.getElementById("badge-name"),
    badgeEvo:         document.getElementById("badge-evo"),
    badgePing:        document.getElementById("badge-ping"),
    connectStatus:    document.getElementById("connect-status"),

    btnBrowse:        document.getElementById("btn-browse"),
    btnBackBrowse:    document.getElementById("btn-back-browse"),
    btnRefreshRooms:  document.getElementById("btn-refresh-rooms"),
    roomList:         document.getElementById("room-list"),

    btnJoinCode:      document.getElementById("btn-join-code"),
    joinCodeInput:    document.getElementById("join-code-input"),
    btnJoinA:         document.getElementById("btn-join-a"),
    btnJoinB:         document.getElementById("btn-join-b"),

    btnCancelQueue:   document.getElementById("btn-cancel-queue"),
    queuePos:         document.getElementById("queue-pos"),
    queueSub:         document.getElementById("queue-sub"),
    queueCount:       document.getElementById("queue-count"),
    queueTimer:       document.getElementById("queue-timer"),
    queueTitle:       document.getElementById("queue-title"),

    btnReady:         document.getElementById("btn-ready"),
    btnHostStart:     document.getElementById("btn-host-start"),
    btnLeaveRoom:     document.getElementById("btn-leave-room"),
    btnLeaveMatch:    document.getElementById("btn-leave-match"),
    btnCopyCode:      document.getElementById("btn-copy-code"),
    roomCodeDisplay:  document.getElementById("room-code-display"),
    roomModeBadge:    document.getElementById("room-mode-badge"),
    roomPlayerCount:  document.getElementById("room-player-count"),
    roomMaxCount:     document.getElementById("room-max-count"),
    seriesScoreBadge: document.getElementById("room-series-score"),
    teamAList:        document.getElementById("team-a-list"),
    teamBList:        document.getElementById("team-b-list"),
    teamACount:       document.getElementById("team-a-count"),
    teamBCount:       document.getElementById("team-b-count"),
    mapVoteCards:     document.getElementById("map-vote-cards"),

    chatMessages:     document.getElementById("chat-messages"),
    chatInput:        document.getElementById("chat-input"),
    btnSendChat:      document.getElementById("btn-send-chat"),

    countdownNum:     document.getElementById("countdown-num"),

    overlayEnd:       document.getElementById("overlay-end"),
    endTitle:         document.getElementById("end-title"),
    endTrophy:        document.getElementById("end-trophy"),
    endScoreboard:    document.getElementById("end-scoreboard"),
    btnPlayAgain:     document.getElementById("btn-play-again"),
    btnEndLobby:      document.getElementById("btn-end-lobby"),

    mpHud:            document.getElementById("mp-hud"),
    hudPlayers:       document.getElementById("hud-players"),
    hudLatency:       document.getElementById("hud-latency"),

    toast:            document.getElementById("toast"),

    // Slice arena (local split-screen)
    sliceArena:       document.getElementById("slice-arena"),
    sliceCanvasP1:    document.getElementById("slice-canvas-p1"),
    sliceCanvasP2:    document.getElementById("slice-canvas-p2"),
    sliceScoreP1:     document.getElementById("slice-score-p1"),
    sliceScoreP2:     document.getElementById("slice-score-p2"),
    sliceComboP1:     document.getElementById("slice-combo-p1"),
    sliceComboP2:     document.getElementById("slice-combo-p2"),

    btnFindDuel:      document.getElementById("btn-find-duel"),
    duelArena:        document.getElementById("duel-arena"),
    duelFrame:        document.getElementById("duel-frame"),
    duelScoreMe:      document.getElementById("duel-score-me"),
    duelScoreOpp:     document.getElementById("duel-score-opp"),
    duelOppName:      document.getElementById("duel-opp-name"),
    duelOppAvatar:    document.getElementById("duel-opp-avatar"),
    duelOppStatus:    document.getElementById("duel-opp-status"),
    duelResult:       document.getElementById("duel-result"),
    duelResultTrophy: document.getElementById("duel-result-trophy"),
    duelResultTitle:  document.getElementById("duel-result-title"),
    duelResultDetail: document.getElementById("duel-result-detail"),
    btnDuelAgain:     document.getElementById("btn-duel-again"),
    btnDuelLobby:     document.getElementById("btn-duel-lobby"),
  };

  const screens = {
    connect:   document.getElementById("screen-connect"),
    home:      document.getElementById("screen-home"),
    browse:    document.getElementById("screen-browse"),
    queue:     document.getElementById("screen-queue"),
    room:      document.getElementById("screen-room"),
    countdown: document.getElementById("screen-countdown"),
  };

  function setScreen(name) {
    Object.values(screens).forEach(el => el?.classList.remove("active"));
    screens[name]?.classList.add("active");
  }

  function setConnectStatus(msg) {
    if (els.connectStatus) els.connectStatus.textContent = msg;
  }

  let toastTimer = null;
  function showToast(msg, type) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden", "success", "error");
    els.toast.classList.add(type === "error" ? "error" : "success");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast?.classList.add("hidden"), 2600);
  }

  /** Local player identity, pulled from the same localStorage profile the
   *  rest of the site uses (see profile.js / firebase-auth.js). */
  function buildProfile() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}
    return {
      name:      (user && user.username) || `Player${Math.floor(Math.random() * 9999)}`,
      badgeIcon: (user && user.equippedBadgeIcon) || "",
      evoStage:  (user && user.evoStage) || 1,
    };
  }

  const state = {
    profile:        buildProfile(),
    roomState:      null,
    ready:          false,
    queueSize:      null,
    queueMode:      "versus", // "versus" | "duel" — which queue btn-cancel-queue should leave
    queueStartedAt: null,
    queueTimerId:   null,
    duelOpponent:   null,
  };

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
    state.queueMode = "versus";
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
    if (state.queueMode === "duel") MP.leaveDuelQueue();
    else MP.leaveQueue();
    stopQueueTimer();
    state.queueSize = null;
    state.queueMode = "versus";
    setScreen("home");
  }

  // ── Duel mode (real normal-mode game, networked 1v1 split screen) ────────

  function joinDuelQueue() {
    if (!MP.connected) {
      showToast("Connecting to server…", "error");
      return;
    }
    state.queueMode = "duel";
    MP.joinDuelQueue(state.profile);
    setScreen("queue");
    if (els.queueTitle) els.queueTitle.textContent = "Finding a Duel opponent…";
    if (els.queueSub) els.queueSub.textContent = "Real normal mode — first mistake loses";
    if (els.queueCount) els.queueCount.textContent = "";
    startQueueTimer();
  }

  function showDuelArena(opponent) {
    stopQueueTimer();
    Object.values(screens).forEach(el => el?.classList.remove("active"));
    state.duelOpponent = opponent;
    if (els.duelOppName) els.duelOppName.textContent = opponent?.name || "OPPONENT";
    if (els.duelOppAvatar) els.duelOppAvatar.textContent = opponent?.avatar === "cube" ? "◆" : (opponent?.avatar || "◆");
    if (els.duelOppStatus) els.duelOppStatus.textContent = "Playing…";
    if (els.duelScoreMe) els.duelScoreMe.textContent = "0";
    if (els.duelScoreOpp) els.duelScoreOpp.textContent = "0";
    if (els.duelFrame) els.duelFrame.src = "./index.html?duelChild=1&t=" + Date.now();
    els.duelArena?.classList.remove("hidden");
  }

  function hideDuelArena() {
    els.duelArena?.classList.add("hidden");
    if (els.duelFrame) els.duelFrame.src = "about:blank";
  }

  function showDuelResult(data) {
    hideDuelArena();
    if (!els.duelResult) return;
    const won = data.winnerId === MP.myId;
    const drew = !data.winnerId;
    if (els.duelResultTrophy) els.duelResultTrophy.textContent = drew ? "🤝" : (won ? "🏆" : "😔");
    if (els.duelResultTitle) els.duelResultTitle.textContent = drew ? "DRAW" : (won ? "YOU WIN!" : "YOU LOSE");
    if (els.duelResultDetail) {
      const reasonText = data.reason === "bomb" ? "destroying a bomb 💣"
        : data.reason === "opponentDisconnected" ? "the other player disconnecting"
        : "missing a good cube 🟦";
      els.duelResultDetail.textContent = won
        ? `Your opponent lost by ${reasonText}.`
        : (drew ? "" : `You lost by ${reasonText}.`);
    }
    els.duelResult.classList.remove("hidden");
  }

  function hideDuelResult() {
    els.duelResult?.classList.add("hidden");
  }

  function leaveDuel() {
    hideDuelArena();
    hideDuelResult();
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
    // Hide all lobby screens; the slice arena takes over
    Object.values(screens).forEach(el => el?.classList.remove("active"));
    if (els.overlayEnd) els.overlayEnd.classList.add("hidden");
    if (els.mpHud) {
      els.mpHud.classList.remove("hidden");
      renderHud();
    }
    showArena();
    startArenaLoop();
  }

  // ── Slice Arena (local split-screen — two players, one device) ──────────
  // Each half runs its own falling-cube mini-game and its own touch input,
  // so two people can play side by side on the same screen. Every slice is
  // reported to the server via MP.sendCubeSliced (server.js is authoritative
  // on score — see calculateScoreDelta there).
  const CUBE_TYPES = [
    { type: "normal", weight: 60, color: "#7b6cff", icon: "◆" },
    { type: "double",  weight: 20, color: "#00e5a0", icon: "◆◆" },
    { type: "golden",  weight: 8,  color: "#ffd84d", icon: "★" },
    { type: "bomb",    weight: 12, color: "#ff4466", icon: "●" },
  ];
  const CUBE_SPAWN_MS = 700;      // avg time between spawns per half
  const CUBE_LIFETIME_MS = 2400;  // how long an unsliced cube lives
  const CUBE_RADIUS = 32;
  const COMBO_WINDOW_MS = 900;    // slice again within this window to keep the combo

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function pickCubeType() {
    const total = CUBE_TYPES.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;
    for (const c of CUBE_TYPES) { if (r < c.weight) return c; r -= c.weight; }
    return CUBE_TYPES[0];
  }

  function makeHalf(canvasEl, scoreEl, comboEl) {
    return {
      canvas: canvasEl,
      ctx: canvasEl ? canvasEl.getContext("2d") : null,
      scoreEl, comboEl,
      cubes: [],
      particles: [],
      activePointers: new Map(), // pointerId -> { points: [{x,y}] }
      combo: 0,
      comboResetAt: 0,
      lastSpawnAt: 0,
      localHits: 0,
      nextCubeId: 1,
    };
  }

  let sliceHalves = null;   // { p1, p2 }
  let sliceRunning = false;
  let sliceRafId = null;
  let sliceLastFrame = 0;

  function showArena() {
    els.sliceArena?.classList.remove("hidden");
    resizeSliceCanvases();
  }
  function hideArena() {
    els.sliceArena?.classList.add("hidden");
  }

  function resizeSliceCanvases() {
    [sliceHalves?.p1, sliceHalves?.p2].forEach(half => {
      if (!half?.canvas) return;
      const rect = half.canvas.getBoundingClientRect();
      half.canvas.width = Math.max(1, Math.round(rect.width || 1));
      half.canvas.height = Math.max(1, Math.round(rect.height || 1));
    });
  }

  function startArenaLoop() {
    if (!sliceHalves) {
      sliceHalves = {
        p1: makeHalf(els.sliceCanvasP1, els.sliceScoreP1, els.sliceComboP1),
        p2: makeHalf(els.sliceCanvasP2, els.sliceScoreP2, els.sliceComboP2),
      };
      wireSliceInput(sliceHalves.p1);
      wireSliceInput(sliceHalves.p2);
      window.addEventListener("resize", resizeSliceCanvases);
    }
    [sliceHalves.p1, sliceHalves.p2].forEach(half => {
      half.cubes = []; half.particles = []; half.combo = 0; half.localHits = 0;
      half.lastSpawnAt = 0;
      updateSliceScoreDisplay(half);
    });
    resizeSliceCanvases();
    sliceRunning = true;
    sliceLastFrame = performance.now();
    sliceRafId = requestAnimationFrame(sliceLoop);
  }

  function stopArenaLoop() {
    sliceRunning = false;
    if (sliceRafId) cancelAnimationFrame(sliceRafId);
    sliceRafId = null;
  }

  function sliceLoop(now) {
    if (!sliceRunning) return;
    const dt = Math.min(0.05, (now - sliceLastFrame) / 1000);
    sliceLastFrame = now;
    updateHalf(sliceHalves.p1, now, dt);
    updateHalf(sliceHalves.p2, now, dt);
    sliceRafId = requestAnimationFrame(sliceLoop);
  }

  function updateHalf(half, now, dt) {
    if (!half.ctx) return;
    const w = half.canvas.width, h = half.canvas.height;

    if (now - half.lastSpawnAt > CUBE_SPAWN_MS) {
      half.lastSpawnAt = now;
      const t = pickCubeType();
      half.cubes.push({
        id: half.nextCubeId++,
        x: CUBE_RADIUS + Math.random() * Math.max(1, w - CUBE_RADIUS * 2),
        y: h + CUBE_RADIUS,
        vy: -(90 + Math.random() * 70),
        r: CUBE_RADIUS,
        type: t,
        spawnedAt: now,
      });
    }

    half.cubes = half.cubes.filter(c => {
      c.y += c.vy * dt;
      return (now - c.spawnedAt) < CUBE_LIFETIME_MS && c.y > -c.r * 2;
    });

    half.particles = half.particles.filter(p => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
      return p.life > 0;
    });

    if (half.combo > 0 && now > half.comboResetAt) {
      half.combo = 0;
      updateSliceScoreDisplay(half);
    }

    renderHalf(half, w, h);
  }

  function renderHalf(half, w, h) {
    const ctx = half.ctx;
    ctx.clearRect(0, 0, w, h);

    for (const c of half.cubes) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = c.type.color;
      ctx.shadowColor = c.type.color;
      ctx.shadowBlur = 16;
      const s = c.r;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.shadowBlur = 0;
      ctx.font = `${Math.round(s * 0.9)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillText(c.type.icon, 0, 2);
      ctx.restore();
    }

    for (const p of half.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const [, pt] of half.activePointers) {
      if (pt.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(pt.points[0].x, pt.points[0].y);
      for (let i = 1; i < pt.points.length; i++) ctx.lineTo(pt.points[i].x, pt.points[i].y);
      ctx.strokeStyle = "rgba(255,255,255,.85)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  function spawnBurst(half, x, y, color) {
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      half.particles.push({
        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        r: 2 + Math.random() * 3, color, life: 0.5, maxLife: 0.5,
      });
    }
  }

  function updateSliceScoreDisplay(half) {
    if (half.scoreEl) half.scoreEl.textContent = String(half.localHits);
    if (half.comboEl) {
      if (half.combo > 1) {
        half.comboEl.textContent = `x${half.combo} combo`;
        half.comboEl.classList.add("show");
      } else {
        half.comboEl.classList.remove("show");
      }
    }
  }

  function sliceCubeAt(half, x, y, now) {
    for (let i = half.cubes.length - 1; i >= 0; i--) {
      const c = half.cubes[i];
      if (Math.hypot(c.x - x, c.y - y) <= c.r * 1.3) {
        half.cubes.splice(i, 1);
        spawnBurst(half, c.x, c.y, c.type.color);

        if (c.type.type === "bomb") {
          half.combo = 0;
          half.comboResetAt = now;
        } else {
          half.combo += 1;
          half.comboResetAt = now + COMBO_WINDOW_MS;
          half.localHits += 1;
        }

        MP.sendCubeSliced({ cubeType: c.type.type, combo: half.combo });
        updateSliceScoreDisplay(half);
        return true;
      }
    }
    return false;
  }

  /** Pointer input scoped to one half's own canvas. Uses the Pointer Events
   *  API (not mouse/touch separately) so two simultaneous touches — one per
   *  half — both work naturally on a single touchscreen. */
  function wireSliceInput(half) {
    const canvas = half.canvas;
    if (!canvas) return;

    function pointFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function onDown(e) {
      const p = pointFromEvent(e);
      half.activePointers.set(e.pointerId, { points: [p] });
      sliceCubeAt(half, p.x, p.y, performance.now());
      canvas.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    }
    function onMove(e) {
      const pt = half.activePointers.get(e.pointerId);
      if (!pt) return;
      const p = pointFromEvent(e);
      pt.points.push(p);
      if (pt.points.length > 8) pt.points.shift();
      sliceCubeAt(half, p.x, p.y, performance.now());
    }
    function onUp(e) {
      half.activePointers.delete(e.pointerId);
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);
  }

  /** Shows every player in the room with their server-authoritative score
   *  (not the local per-half hit counters, which are just visual feedback). */
  function renderHud() {
    if (!els.hudPlayers) return;
    clearNode(els.hudPlayers);
    MP.allPlayers().forEach(player => {
      const pill = document.createElement("div");
      pill.className = "hud-player-pill" + (player.id === MP.myId ? " me" : "");
      pill.innerHTML =
        `<span>${evoIcon(player.evoStage)}</span>` +
        `<span>${player.name}</span>` +
        `<span style="color:var(--gold)">${player.score ?? 0}</span>`;
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
    MP.on("remoteScore", () => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("remoteEvo", () => {
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("scoreUpdate", () => {
      // Server's authoritative confirmation of our own score/evo stage —
      // just refresh the shared HUD, since MP.roomState already reflects it.
      if (els.mpHud && !els.mpHud.classList.contains("hidden")) renderHud();
    });
    MP.on("ping", () => {
      updateHeader();
      if (els.hudLatency) els.hudLatency.textContent = `${MP.latency || "--"} ms`;
    });
    MP.on("gameEnd", (data) => {
      showEndOverlay(data);
    });

    // ── Duel mode ────────────────────────────────────────────────────────
    MP.on("duelQueueStatus", () => {
      if (els.queueSub) els.queueSub.textContent = "Waiting for an opponent…";
      if (!state.queueStartedAt) startQueueTimer();
      setScreen("queue");
    });
    MP.on("duelStart", (data) => {
      showToast("Duel found!", "success");
      showDuelArena(data?.opponent);
    });
    MP.on("duelOpponentProgress", (data) => {
      if (els.duelScoreOpp) els.duelScoreOpp.textContent = String(data?.score ?? 0);
    });
    MP.on("duelEnd", (data) => {
      showDuelResult(data || {});
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

    // ── Duel mode ────────────────────────────────────────────────────────
    els.btnFindDuel?.addEventListener("click", joinDuelQueue);

    els.btnDuelAgain?.addEventListener("click", () => {
      hideDuelResult();
      joinDuelQueue();
    });

    els.btnDuelLobby?.addEventListener("click", leaveDuel);

    // Bridge from the duel iframe (duel-child.js), which posts "ready",
    // "progress" (score ticks), and "end" (bomb hit / missed cube) messages.
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin) return;
      const d = event.data || {};
      if (d.source !== "cube-game-duel") return;

      if (d.type === "progress") {
        if (els.duelScoreMe) els.duelScoreMe.textContent = String(d.score ?? 0);
        MP.sendDuelProgress(d.score ?? 0);
      } else if (d.type === "end") {
        MP.sendDuelLost(d.reason || "missed");
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
