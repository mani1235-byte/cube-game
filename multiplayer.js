// ⬇️ Replace with your Railway URL (only need to do this once!)
window.CUBE_SERVER = 'https://cube-game-production-e946.up.railway.app/';

/**
 * multiplayer.js
 * Client-side multiplayer bridge for Cube Evolution.
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
    roomMode: null,     // 'coop' | 'versus'
    roomState: null,
    myId: null,
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
    s.on('hostChanged',   d => { MP.isHost = d.newHostId === MP.myId; MP._emit('hostChanged', d); });
    s.on('matchFound',    d => { MP._emit('matchFound', d); });
    s.on('queueStatus',   d => { MP._emit('queueStatus', d); });
    s.on('countdown',     d => { MP._emit('countdown', d); });
    s.on('chat',          d => { MP._emit('chat', d); });
    s.on('error',         d => { MP._emit('serverError', d); });

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
    s.on('playerDied',    d => { MP._emit('playerDied', d); });
    s.on('bombExploded',  d => { MP._emit('bombExploded', d); });
    s.on('heartCollected',d => { MP._emit('heartCollected', d); });
    s.on('gameEvent',     d => { MP._emit('gameEvent', d); });
    s.on('pong',          ts => { MP.latency = Math.round((Date.now() - ts) / 2); MP._emit('ping', MP.latency); });
  };

  MP.disconnect = function () {
    MP._stopSendLoop();
    MP._stopPing();
    if (MP.socket) { MP.socket.disconnect(); MP.socket = null; }
  };

  // ─── Room API ─────────────────────────────────────────────────────────────

  MP.createRoom = function (mode, profile) {
    return new Promise((resolve, reject) => {
      if (!MP.connected) return reject('Not connected');
      MP.socket.emit('createRoom', { mode, profile }, res => {
        if (res.error) return reject(res.error);
        MP.roomCode = res.code;
        MP.roomMode = mode;
        MP.isHost   = true;
        MP.inRoom   = true;
        MP._applyRoomState(res.room);
        resolve(res);
      });
    });
  };

  MP.joinRoom = function (code, profile) {
    return new Promise((resolve, reject) => {
      if (!MP.connected) return reject('Not connected');
      MP.socket.emit('joinRoom', { code, profile }, res => {
        if (res.error) return reject(res.error);
        MP.roomCode = code.toUpperCase();
        MP.inRoom   = true;
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
    MP.remotePlayers.clear();
  };

  MP.joinQueue = function (mode, profile) {
    if (!MP.connected) return;
    MP.socket.emit('joinQueue', { mode, profile });
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

  // ─── Internal ─────────────────────────────────────────────────────────────

  MP._applyRoomState = function (roomState) {
    if (!roomState) return;
    MP.roomState = roomState;
    MP.roomMode  = roomState.mode;
    MP.isHost    = roomState.hostId === MP.myId;
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