// Backend URL now lives in one place: server-config.js (loaded before this
// file). Falls back here only if that script wasn't included on this page.
window.CUBE_SERVER = window.CUBE_SERVER || 'https://cube-game-fnam.onrender.com/';

/**
 * multiplayer.js
 * Client-side multiplayer bridge for Cube Evolution — Team Versus.
 *
 * Every match is Team A vs Team B, 1-4 players per side (players choose
 * their own team). There is no co-op mode anymore.
 *
 * Two ways to play:
 *   - Room code: create a room (pick a team size 1-4), share the code,
 *     friends join and freely pick Team A or Team B.
 *   - Quick play: pick a size (1v1 / 2v2 / 3v3 / 4v4) and the server
 *     auto-matches you against another team of the same size.
 *
 * Drop this into your existing game — it hooks into script.js, mechanics.js,
 * cube-evolution.js without modifying them directly.
 *
 * Usage: include AFTER socket.io.min.js, BEFORE script.js
 *   <script src="/socket.io/socket.io.js"></script>
 *   <script src="multiplayer.js"></script>
 *   <script src="script.js"></script>
 */

(function () {
  'use strict';

  // ─── Config ───────────────────────────────────────────────────────────────

  const SERVER_URL = window.CUBE_SERVER || window.location.origin || 'https://firstgame.org';
  const SEND_RATE  = 30;   // Hz — how often we send our state to the server
  const PING_RATE  = 3000; // ms

  // ─── State ────────────────────────────────────────────────────────────────

  const MP = window.CubeMultiplayer = {
    socket: null,
    connected: false,
    inRoom: false,
    roomCode: null,
    roomState: null,   // { code, teamSize, state, hostId, quickPlay, teams: {A:[...], B:[...]}, gameData }
    myId: null,
    myTeam: null,       // 'A' | 'B'
    isHost: false,
    remotePlayers: new Map(),   // id → { state, element, lastSeen }
    callbacks: {},
    _sendInterval: null,
    _pingInterval: null,
    _pingTs: 0,
    latency: 0
  };

  // ─── Connect ──────────────────────────────────────────────────────────────

  MP.connect = function () {
    if (MP.socket) return;
    if (typeof io === 'undefined') {
      console.error('[multiplayer] socket.io client not loaded — multiplayer is unavailable this session.');
      return;
    }
    MP.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      reconnectionAttempts: Infinity
    });
    const s = MP.socket;

    s.on('connect', () => {
      MP.connected = true;
      MP.myId = s.id;
      MP._startPing();
      MP._emit('connected', { id: s.id });
    });

    s.on('reconnect', () => {
      MP.connected = true;
      MP.myId = s.id;
      MP._emit('reconnected', { id: s.id });
    });

    s.on('disconnect', () => {
      MP.connected = false;
      MP.inRoom = false;
      MP._stopSendLoop();
      MP._stopPing();
      MP._emit('disconnected');
    });

    // ── Lobby events ────────────────────────────────────────────────────────

    s.on('playerJoined',  d => { MP._applyRoomState(d.roomState); MP._emit('playerJoined', d); });
    s.on('playerLeft',    d => { MP._removeRemotePlayer(d.playerId); MP._applyRoomState(d.roomState); MP._emit('playerLeft', d); });
    s.on('playerReady',   d => { MP._applyRoomState(d.roomState); MP._emit('playerReady', d); });
    s.on('teamChanged',   d => { MP._applyRoomState(d.roomState); MP._emit('teamChanged', d); });
    s.on('hostChanged',   d => { MP.isHost = d.newHostId === MP.myId; MP._emit('hostChanged', d); });
    s.on('matchFound',    d => { MP._emit('matchFound', d); });
    s.on('queueStatus',   d => { MP._emit('queueStatus', d); });
    s.on('countdown',     d => { MP._emit('countdown', d); });
    s.on('chat',          d => { MP._emit('chat', d); });
    s.on('error',         d => { MP._emit('serverError', d); });
    s.on('kicked',        d => { MP._emit('kicked', d); });

    // ── Game events ─────────────────────────────────────────────────────────

    s.on('gameStart', d => {
      MP._applyRoomState(d.roomState);
      MP._startSendLoop();
      MP._emit('gameStart', d);
    });

    s.on('gameEnd', d => {
      MP._stopSendLoop();
      MP.inRoom = false;
      // Clear remote players from canvas
      MP.remotePlayers.forEach((rp) => rp.element?.remove());
      MP.remotePlayers.clear();
      MP._emit('gameEnd', d);
    });

    s.on('remoteState', d => {
      let rp = MP.remotePlayers.get(d.id);
      if (!rp) { rp = { state: {}, element: null }; MP.remotePlayers.set(d.id, rp); }
      Object.assign(rp.state, d);
      rp.lastSeen = Date.now();
      MP._emit('remoteState', d);
    });

    s.on('remoteInput',   d => { MP._emit('remoteInput', d); });
    s.on('remoteEvo',     d => { MP._emit('remoteEvo', d); });
    s.on('remoteScore',   d => { MP._emit('remoteScore', d); });
    s.on('playerDied',    d => {
      const rp = MP.remotePlayers.get(d.playerId);
      if (rp) rp.state.alive = false;
      MP._emit('playerDied', d);
    });
    s.on('remoteShoot',   d => { MP._emit('remoteShoot', d); });
    s.on('remoteHealth',  d => {
      const rp = MP.remotePlayers.get(d.playerId);
      if (rp) rp.state.hp = d.hp;
      MP._emit('remoteHealth', d);
    });
    s.on('bombExploded',  d => { MP._emit('bombExploded', d); });
    s.on('heartCollected',d => { MP._emit('heartCollected', d); });
    s.on('gameEvent',     d => { MP._emit('gameEvent', d); });
    s.on('gameReward',    d => { MP._emit('gameReward', d); });
    s.on('pong',          ts => { MP.latency = Math.round((Date.now() - ts) / 2); MP._emit('ping', MP.latency); });
  };

  MP.disconnect = function () {
    MP._stopSendLoop();
    MP._stopPing();
    if (MP.socket) { MP.socket.disconnect(); MP.socket = null; }
  };

  // ─── Room API ─────────────────────────────────────────────────────────────

  /**
   * Create a private room with a room code. `teamSize` is the cap per side
   * (1 = 1v1 room, 4 = 4v4 room). The host is placed on Team A.
   */
  MP.createRoom = function (teamSize, profile) {
    return new Promise((resolve, reject) => {
      if (!MP.connected) return reject('Not connected');
      MP.socket.emit('createRoom', { teamSize, profile }, res => {
        if (res.error) return reject(res.error);
        MP.roomCode = res.code;
        MP.isHost   = true;
        MP.inRoom   = true;
        MP.myTeam   = res.team || 'A';
        MP._applyRoomState(res.room);
        resolve(res);
      });
    });
  };

  /**
   * Join a room by code. `team` is 'A' or 'B' — the side the player picked.
   * If omitted, or that side is full, the server assigns whichever team has
   * room.
   */
  MP.joinRoom = function (code, team, profile) {
    return new Promise((resolve, reject) => {
      if (!MP.connected) return reject('Not connected');
      MP.socket.emit('joinRoom', { code, team, profile }, res => {
        if (res.error) return reject(res.error);
        MP.roomCode = code.toUpperCase();
        MP.inRoom   = true;
        MP.myTeam   = res.team || team || null;
        MP._applyRoomState(res.room);
        resolve(res);
      });
    });
  };

  /** Switch sides pre-game (only works while the room is still waiting). */
  MP.switchTeam = function (team) {
    return new Promise((resolve, reject) => {
      if (!MP.inRoom || !MP.socket) return reject('Not in a room');
      MP.socket.emit('switchTeam', { team }, res => {
        if (res.error) return reject(res.error);
        MP.myTeam = team;
        MP._applyRoomState(res.room);
        resolve(res);
      });
    });
  };

  MP.leaveRoom = function () {
    if (MP.socket) MP.socket.emit('leaveRoom');
    MP._stopSendLoop();
    MP.inRoom    = false;
    MP.roomCode  = null;
    MP.roomState = null;
    MP.myTeam    = null;
    MP.remotePlayers.clear();
  };

  /**
   * Quick play matchmaking. `size` is 1-4 (1v1 through 4v4). Server places
   * the first half of matched players on Team A, second half on Team B —
   * teams aren't chosen by the player in quick play, since it's meant to be
   * instant.
   */
  MP.joinQueue = function (size, profile) {
    if (!MP.connected) return;
    MP.socket.emit('joinQueue', { size, profile });
  };

  MP.leaveQueue = function () {
    if (MP.socket) MP.socket.emit('leaveQueue');
  };

  MP.getRooms = function () {
    return new Promise(resolve => {
      if (!MP.connected) return resolve([]);
      MP.socket.emit('getRooms', list => resolve(list || []));
    });
  };

  MP.setReady = function (ready) {
    if (!MP.inRoom) return;
    MP.socket.emit('setReady', { ready });
  };

  MP.hostStart = function () {
    if (!MP.isHost) return;
    MP.socket.emit('hostStartGame');
  };

  MP.sendChat = function (message) {
    if (!MP.inRoom) return;
    MP.socket.emit('chat', { message });
  };

  // ─── Game state sync ──────────────────────────────────────────────────────

  /**
   * Call this every frame (or on significant change) with your player's state.
   * Kept lightweight — only send what changed via _sendLoop.
   */
  MP.updateMyState = function (state) {
    MP._pendingState = state;
  };

  MP.sendInput = function (input) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('playerInput', input);
  };

  MP.sendDied = function (killedBy) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('playerDied', { killedBy });
  };

  MP.sendShoot = function (data) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('playerShoot', data);
  };

  MP.sendDamage = function (amount) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('playerDamaged', { amount });
  };

  MP.sendBomb = function (data) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('bombExploded', data);
  };

  MP.sendHeart = function (data) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('heartCollected', data);
  };

  MP.sendEvo = function (stage) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('evoStageUp', { stage });
  };

  MP.sendEvent = function (event) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('gameEvent', event);
  };

  MP.sendCubeSliced = function (event) {
    if (!MP.inRoom || !MP.socket) return;
    MP.socket.emit('cubeSliced', event);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Flat array of everyone in the room, both teams, each tagged with .team */
  MP.allPlayers = function () {
    if (!MP.roomState) return [];
    return [...(MP.roomState.teams?.A || []), ...(MP.roomState.teams?.B || [])];
  };

  MP.myTeammates = function () {
    if (!MP.roomState || !MP.myTeam) return [];
    return (MP.roomState.teams?.[MP.myTeam] || []).filter(p => p.id !== MP.myId);
  };

  MP.opponents = function () {
    if (!MP.roomState || !MP.myTeam) return [];
    const other = MP.myTeam === 'A' ? 'B' : 'A';
    return MP.roomState.teams?.[other] || [];
  };

  // ─── Internal ─────────────────────────────────────────────────────────────

  MP._applyRoomState = function (roomState) {
    if (!roomState) return;
    MP.roomState = roomState;
    MP.isHost    = roomState.hostId === MP.myId;
    if (roomState.teams) {
      if (roomState.teams.A?.some(p => p.id === MP.myId)) MP.myTeam = 'A';
      else if (roomState.teams.B?.some(p => p.id === MP.myId)) MP.myTeam = 'B';
    }
    MP._emit('roomState', roomState);
  };

  MP._removeRemotePlayer = function (id) {
    const rp = MP.remotePlayers.get(id);
    if (rp?.element) rp.element.remove();
    MP.remotePlayers.delete(id);
  };

  MP._startSendLoop = function () {
    MP._stopSendLoop();
    const interval = Math.floor(1000 / SEND_RATE);
    MP._sendInterval = setInterval(() => {
      if (MP._pendingState && MP.socket) {
        MP.socket.emit('playerState', MP._pendingState);
        MP._pendingState = null;
      }
    }, interval);
  };

  MP._stopSendLoop = function () {
    if (MP._sendInterval) { clearInterval(MP._sendInterval); MP._sendInterval = null; }
  };

  MP._startPing = function () {
    MP._stopPing();
    MP._pingInterval = setInterval(() => {
      if (MP.socket) MP.socket.emit('ping', Date.now());
    }, PING_RATE);
  };

  MP._stopPing = function () {
    if (MP._pingInterval) { clearInterval(MP._pingInterval); MP._pingInterval = null; }
  };

  // ─── Event bus ────────────────────────────────────────────────────────────

  MP.on = function (event, cb) {
    if (!MP.callbacks[event]) MP.callbacks[event] = [];
    MP.callbacks[event].push(cb);
    return MP; // chainable
  };

  MP.off = function (event, cb) {
    if (!MP.callbacks[event]) return;
    MP.callbacks[event] = MP.callbacks[event].filter(fn => fn !== cb);
  };

  MP._emit = function (event, data) {
    (MP.callbacks[event] || []).forEach(fn => { try { fn(data); } catch(e) { console.warn('[MP]', e); } });
  };

  // ─── Auto-connect ─────────────────────────────────────────────────────────

  // Connect immediately so the socket is ready when the lobby opens.
  // Remove this line if you prefer lazy connection.
  window.addEventListener('DOMContentLoaded', () => MP.connect());

})();
