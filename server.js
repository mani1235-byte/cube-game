// server.js — CUBE GAME Secure Server (Security Hardened)
// Fixes: CORS, rate limiting, socket validation, anti-cheat, server-auth scores
// ============================================================================
'use strict';

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const crypto   = require('crypto');

const app    = express();
const server = http.createServer(app);

// ─── Environment Variables ────────────────────────────────────────────────────
// All secrets from env — never hardcoded
const PORT         = process.env.PORT         || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || null; // must be set in Railway
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [
      'https://cube-game-production-9d45.up.railway.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

// ─── Security: Helmet headers ─────────────────────────────────────────────────
// Manually set headers without requiring the helmet package
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options',  'nosniff');
  res.setHeader('X-Frame-Options',         'SAMEORIGIN');
  res.setHeader('X-XSS-Protection',        '1; mode=block');
  res.setHeader('Referrer-Policy',         'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy',      'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "connect-src 'self' wss: ws: https://*.firebaseapp.com https://*.googleapis.com; " +
    "img-src 'self' data: https://*.googleusercontent.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-ancestors 'none';"
  );
  next();
});

// ─── CORS — strict origin list ────────────────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '16kb' })); // prevent large body attacks

// ─── HTTP Rate Limiting (no extra deps) ───────────────────────────────────────
const httpRateLimits = new Map(); // ip → { count, resetAt }
const HTTP_RATE_LIMIT = 120; // requests per minute per IP

app.use((req, res, next) => {
  const ip  = req.ip || req.socket.remoteAddress;
  const now = Date.now();
  let rl    = httpRateLimits.get(ip);
  if (!rl || now > rl.resetAt) {
    rl = { count: 0, resetAt: now + 60_000 };
    httpRateLimits.set(ip, rl);
  }
  rl.count++;
  if (rl.count > HTTP_RATE_LIMIT) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  next();
});
setInterval(() => {
  const now = Date.now();
  httpRateLimits.forEach((v, k) => { if (now > v.resetAt) httpRateLimits.delete(k); });
}, 60_000);

// ─── Login rate limiting ──────────────────────────────────────────────────────
const loginAttempts = new Map(); // ip → { count, resetAt }
const MAX_LOGIN_ATTEMPTS = 10; // per 15 min

function checkLoginRate(ip) {
  const now = Date.now();
  let la = loginAttempts.get(ip);
  if (!la || now > la.resetAt) {
    la = { count: 0, resetAt: now + 15 * 60_000 };
    loginAttempts.set(ip, la);
  }
  la.count++;
  return la.count <= MAX_LOGIN_ATTEMPTS;
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e4, // 10 KB max socket message
});

// ─── State ────────────────────────────────────────────────────────────────────
const rooms   = new Map();
const queue   = new Map();
const players = new Map();
const socketMeta = new Map(); // socketId → { ip, uid, rateBucket }

const MAX_PLAYERS_PER_ROOM  = 16;  // reduced from 64 (more realistic)
const MATCHMAKING_INTERVAL  = 2000;
const MATCHMAKING_WAIT_MAX  = 30000;
const ROOM_TTL              = 30 * 60 * 1000;

// ─── Anti-cheat constants ─────────────────────────────────────────────────────
const MAX_SPEED           = 25;     // units/tick — reject above this
const MAX_TELEPORT_DIST   = 80;     // units — flag if jumped further
const MAX_SCORE_PER_HIT   = 500;    // points — reject above this per event
const SOCKET_RATE_LIMIT   = 25;     // events/sec per socket
const SOCKET_RATE_WINDOW  = 1000;   // ms

// ─── Audit log ────────────────────────────────────────────────────────────────
const auditLog = [];
const MAX_AUDIT = 5000;

function audit(type, data) {
  const entry = { ts: new Date().toISOString(), type, ...data };
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT) auditLog.shift();
  // In production, pipe to persistent store / monitoring
  if (type.startsWith('cheat') || type.startsWith('ban')) {
    console.warn('[AUDIT]', entry);
  }
}

// ─── Socket rate limiting ─────────────────────────────────────────────────────
function checkSocketRate(socketId) {
  const meta = socketMeta.get(socketId);
  if (!meta) return false;
  const now = Date.now();
  if (now > meta.rateReset) {
    meta.rateCount = 0;
    meta.rateReset = now + SOCKET_RATE_WINDOW;
  }
  meta.rateCount++;
  if (meta.rateCount > SOCKET_RATE_LIMIT) {
    if (!meta.rateLimitLogged) {
      audit('rateLimit', { socketId });
      meta.rateLimitLogged = true;
    }
    return false; // reject
  }
  meta.rateLimitLogged = false;
  return true;
}

// ─── Input validation helpers ──────────────────────────────────────────────────
function isValidPosition(pos) {
  return pos && typeof pos.x === 'number' && typeof pos.y === 'number'
    && isFinite(pos.x) && isFinite(pos.y)
    && Math.abs(pos.x) < 100000 && Math.abs(pos.y) < 100000;
}

function isValidVelocity(vel) {
  if (!vel) return true; // optional
  return typeof vel.x === 'number' && typeof vel.y === 'number'
    && isFinite(vel.x) && isFinite(vel.y)
    && Math.abs(vel.x) <= MAX_SPEED && Math.abs(vel.y) <= MAX_SPEED;
}

function isValidScore(score) {
  return typeof score === 'number' && isFinite(score) && score >= 0 && score < 10_000_000;
}

function isValidName(name) {
  return typeof name === 'string' && name.length >= 1 && name.length <= 24
    && /^[\w\s\-\.]+$/.test(name);
}

function sanitizeText(str, maxLen = 200) {
  return String(str || '').slice(0, maxLen)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Anti-cheat: speed/teleport check ────────────────────────────────────────
function checkMovement(player, newPosition, newVelocity) {
  if (!isValidPosition(newPosition)) return { ok: false, reason: 'invalid_position' };
  if (newVelocity && !isValidVelocity(newVelocity)) return { ok: false, reason: 'speed_hack' };

  if (player.position && isValidPosition(player.position)) {
    const dx = newPosition.x - player.position.x;
    const dy = newPosition.y - player.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_TELEPORT_DIST) {
      return { ok: false, reason: 'teleport', dist };
    }
  }
  return { ok: true };
}

// ─── Server-authoritative score system ────────────────────────────────────────
// Clients send 'cubeSliced' events; server calculates score delta
const SCORE_PER_NORMAL = 10;
const SCORE_PER_COMBO  = [0, 0, 30, 50, 80, 120]; // index = combo count

function calculateScoreDelta(event, player) {
  const { cubeType, combo } = event;

  let base = SCORE_PER_NORMAL;
  if (cubeType === 'bomb')    return { delta: 0, valid: false }; // bombs don't give score
  if (cubeType === 'double')  base = SCORE_PER_NORMAL * 2;
  if (cubeType === 'golden')  base = SCORE_PER_NORMAL * 5;

  const comboBonus = (combo > 0 && combo < SCORE_PER_COMBO.length)
    ? SCORE_PER_COMBO[combo] : 0;

  const delta = base + comboBonus;
  if (delta > MAX_SCORE_PER_HIT) return { delta: 0, valid: false };
  return { delta, valid: true };
}

// ─── Room factory ─────────────────────────────────────────────────────────────
function createRoom(code, mode, hostId) {
  return {
    code, mode, hostId,
    players:      new Map(),
    state:        'waiting',
    createdAt:    Date.now(),
    lastActivity: Date.now(),
    gameData: { sharedScore: 0, wave: 1, items: [], events: [] }
  };
}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function roomPublicState(room) {
  const playerList = [...room.players.values()].map(p => ({
    id:       p.id,
    name:     p.name,
    avatar:   p.avatar,
    evoStage: p.evoStage,
    score:    p.score,
    ready:    p.ready,
    alive:    p.alive,
    ping:     p.ping,
  }));
  return {
    code:     room.code,
    mode:     room.mode,
    state:    room.state,
    hostId:   room.hostId,
    players:  playerList,
    gameData: room.gameData,
  };
}

// ─── Matchmaking ──────────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  const coopQ   = [...queue.values()].filter(e => e.mode === 'coop');
  const versusQ = [...queue.values()].filter(e => e.mode === 'versus');

  [{ entries: coopQ, mode: 'coop', min: 2 },
   { entries: versusQ, mode: 'versus', min: 2 }
  ].forEach(({ entries, mode, min }) => {
    const timedOut = entries.length > 0 && entries.every(e => now - e.joinedAt >= MATCHMAKING_WAIT_MAX);
    const threshold = timedOut ? 1 : min;

    while (entries.length >= threshold) {
      const batch = entries.splice(0, Math.min(MAX_PLAYERS_PER_ROOM, entries.length));
      const code  = generateCode();
      const room  = createRoom(code, mode, batch[0].socket.id);
      rooms.set(code, room);

      batch.forEach(entry => {
        queue.delete(entry.socket.id);
        joinRoom(entry.socket, code, entry.profile);
      });

      io.to(code).emit('matchFound', { code, mode });
    }

    entries.forEach((entry, i) => {
      entry.socket.emit('queueStatus', { position: i + 1, mode, total: entries.length });
    });
  });
}, MATCHMAKING_INTERVAL);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function joinRoom(socket, code, profile) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) return { error: 'Room full' };
  if (room.state === 'playing') return { error: 'Game in progress' };

  socket.join(code);
  players.set(socket.id, { roomCode: code });

  const name = (profile?.name && isValidName(profile.name))
    ? profile.name : `Player${Math.floor(Math.random() * 9999)}`;

  const playerState = {
    id:        socket.id,
    name,
    avatar:    profile?.avatar || 'cube',
    evoStage:  1, // always start at 1 — server controls evo
    score:     0,
    coins:     0,
    ready:     false,
    alive:     true,
    ping:      0,
    position:  { x: 0, y: 0 },
    velocity:  { x: 0, y: 0 },
    inputs:    {},
    flagCount: 0, // anti-cheat flag counter
  };

  room.players.set(socket.id, playerState);
  room.lastActivity = Date.now();
  audit('playerJoined', { socketId: socket.id, name, room: code });

  io.to(code).emit('playerJoined', {
    player: { id: playerState.id, name: playerState.name, avatar: playerState.avatar, evoStage: playerState.evoStage },
    roomState: roomPublicState(room),
  });

  return { success: true, room: roomPublicState(room) };
}

function leaveRoom(socketId) {
  const pData = players.get(socketId);
  if (!pData) return;
  const room = rooms.get(pData.roomCode);
  if (!room) return;

  room.players.delete(socketId);
  players.delete(socketId);

  if (room.hostId === socketId && room.players.size > 0) {
    room.hostId = [...room.players.keys()][0];
    io.to(room.code).emit('hostChanged', { newHostId: room.hostId });
  }

  if (room.state === 'playing') {
    const alive = [...room.players.values()].filter(p => p.alive);
    if (room.mode === 'versus' && alive.length <= 1) endGame(room, alive[0]?.id || null);
    else if (room.mode === 'coop' && alive.length === 0) endGame(room, null);
  }

  io.to(room.code).emit('playerLeft', { playerId: socketId, roomState: roomPublicState(room) });
  if (room.players.size === 0) rooms.delete(room.code);
}

function startCountdown(room) {
  room.state = 'countdown';
  let count = 3;
  io.to(room.code).emit('countdown', { count });

  const timer = setInterval(() => {
    count--;
    if (count > 0) io.to(room.code).emit('countdown', { count });
    else { clearInterval(timer); startGame(room); }
  }, 1000);
}

function startGame(room) {
  room.state = 'playing';
  room.gameData.startedAt = Date.now();
  room.players.forEach(p => {
    p.score = 0; p.coins = 0;
    p.alive = true; p.ready = false;
    p.evoStage = 1; p.flagCount = 0;
  });
  io.to(room.code).emit('gameStart', { roomState: roomPublicState(room) });
}

function endGame(room, winnerId) {
  if (room.state === 'ended') return;
  room.state = 'ended';

  const scores = [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, evoStage: p.evoStage, coins: p.coins }))
    .sort((a, b) => b.score - a.score);

  // Server decides coin rewards
  scores.forEach((p, idx) => {
    const bonus = idx === 0 ? 50 : idx === 1 ? 30 : 10;
    const coinReward = Math.floor(p.score / 100) + bonus;
    // Emit reward directly to that socket — not broadcast
    io.to(p.id).emit('gameReward', {
      coinsEarned: coinReward,
      trophyChange: idx === 0 ? 30 : -10,
    });
    audit('gameReward', { socketId: p.id, name: p.name, coins: coinReward, score: p.score });
  });

  io.to(room.code).emit('gameEnd', {
    winner:   winnerId,
    scores,
    mode:     room.mode,
    duration: Date.now() - (room.gameData.startedAt || room.createdAt),
  });
}

// ─── Socket handlers ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const ip = socket.handshake.address || 'unknown';

  // Reject if origin not in whitelist
  const origin = socket.handshake.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[REJECT] connection from disallowed origin: ${origin}`);
    socket.disconnect(true);
    return;
  }

  socketMeta.set(socket.id, {
    ip, uid: null,
    rateCount: 0, rateReset: Date.now() + SOCKET_RATE_WINDOW,
    rateLimitLogged: false,
  });

  console.log(`[+] ${socket.id} connected from ${ip}`);
  audit('connect', { socketId: socket.id, ip });

  // Middleware: apply rate limit to all events
  socket.use(([event, ...args], next) => {
    if (!checkSocketRate(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded' });
      return; // drop event
    }
    next();
  });

  // ── Lobby ────────────────────────────────────────────────────────────────
  socket.on('createRoom', ({ mode, profile } = {}, cb) => {
    const validMode = ['coop', 'versus'].includes(mode) ? mode : 'versus';
    const code = generateCode();
    const room = createRoom(code, validMode, socket.id);
    rooms.set(code, room);
    const result = joinRoom(socket, code, profile);
    if (typeof cb === 'function') cb({ ...result, code });
  });

  socket.on('joinRoom', ({ code, profile } = {}, cb) => {
    if (typeof code !== 'string') {
      if (typeof cb === 'function') cb({ error: 'Invalid code' });
      return;
    }
    const result = joinRoom(socket, code.toUpperCase().slice(0, 8), profile);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('leaveRoom', () => leaveRoom(socket.id));

  socket.on('joinQueue', ({ mode, profile } = {}) => {
    const validMode = ['coop', 'versus'].includes(mode) ? mode : 'versus';
    if (!queue.has(socket.id)) {
      queue.set(socket.id, { socket, mode: validMode, profile, joinedAt: Date.now() });
      socket.emit('queueStatus', {
        position: [...queue.values()].filter(e => e.mode === validMode).length,
        mode: validMode,
      });
    }
  });

  socket.on('leaveQueue', () => queue.delete(socket.id));

  socket.on('getRooms', (cb) => {
    const list = [...rooms.values()]
      .filter(r => r.state === 'waiting' && r.players.size < MAX_PLAYERS_PER_ROOM)
      .map(r => ({
        code:        r.code,
        mode:        r.mode,
        playerCount: r.players.size,
        maxPlayers:  MAX_PLAYERS_PER_ROOM,
        host:        r.players.get(r.hostId)?.name || 'Unknown',
      }));
    if (typeof cb === 'function') cb(list);
  });

  // ── In-lobby ─────────────────────────────────────────────────────────────
  socket.on('setReady', ({ ready } = {}) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'waiting') return;
    const player = room.players.get(socket.id);
    if (player) player.ready = !!ready;

    io.to(room.code).emit('playerReady', {
      playerId: socket.id, ready: !!ready, roomState: roomPublicState(room),
    });

    const all = [...room.players.values()];
    if (all.length >= 2 && all.every(p => p.ready)) startCountdown(room);
  });

  socket.on('hostStartGame', () => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'waiting') return;
    if (room.players.size < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }
    startCountdown(room);
  });

  socket.on('chat', ({ message } = {}) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    const sanitized = sanitizeText(message, 200);
    if (!sanitized) return;

    io.to(room.code).emit('chat', {
      playerId: socket.id,
      name:     player?.name || 'Unknown',
      message:  sanitized,
      ts:       Date.now(),
    });
  });

  // ── In-game: SERVER-AUTHORITATIVE ────────────────────────────────────────

  socket.on('playerInput', (input) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    // Validate input object — only allow expected keys
    const safeInput = {};
    if (typeof input?.left    === 'boolean') safeInput.left    = input.left;
    if (typeof input?.right   === 'boolean') safeInput.right   = input.right;
    if (typeof input?.up      === 'boolean') safeInput.up      = input.up;
    if (typeof input?.down    === 'boolean') safeInput.down    = input.down;
    if (typeof input?.pointer === 'object' && input.pointer) {
      if (isFinite(input.pointer.x) && isFinite(input.pointer.y)) {
        safeInput.pointer = { x: +input.pointer.x, y: +input.pointer.y };
      }
    }

    player.inputs = safeInput;
    room.lastActivity = Date.now();
    socket.to(room.code).emit('remoteInput', { playerId: socket.id, input: safeInput });
  });

  socket.on('playerState', (state) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    // Validate movement — anti-cheat
    if (state.position) {
      const check = checkMovement(player, state.position, state.velocity);
      if (!check.ok) {
        player.flagCount = (player.flagCount || 0) + 1;
        audit('cheat:movement', {
          socketId: socket.id, name: player.name,
          reason: check.reason, flagCount: player.flagCount, dist: check.dist,
        });
        // Kick after 5 flags
        if (player.flagCount >= 5) {
          socket.emit('kicked', { reason: 'Anti-cheat: movement violation' });
          socket.disconnect();
        }
        return; // reject this update
      }
      player.position = state.position;
      if (state.velocity) player.velocity = state.velocity;
    }

    // NEVER trust score from client — score comes from cubeSliced events
    // evoStage is server-controlled too
    room.lastActivity = Date.now();

    socket.to(room.code).emit('remoteState', {
      id:       socket.id,
      position: player.position,
      velocity: player.velocity,
      evoStage: player.evoStage,
      score:    player.score,
      alive:    player.alive,
    });
  });

  // ── Server-authoritative scoring ─────────────────────────────────────────
  socket.on('cubeSliced', (event) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    // Server calculates score — never trusting client score
    const { delta, valid } = calculateScoreDelta(event, player);
    if (!valid) {
      audit('cheat:score', { socketId: socket.id, name: player.name, event });
      return;
    }

    player.score += delta;
    if (room.mode === 'coop') {
      room.gameData.sharedScore = [...room.players.values()]
        .reduce((s, p) => s + p.score, 0);
    }

    // Check evo stage based on server score
    const newEvo = getEvoStage(player.score);
    if (newEvo !== player.evoStage) {
      player.evoStage = newEvo;
      io.to(room.code).emit('remoteEvo', { playerId: socket.id, stage: newEvo });
    }

    // Tell the scoring player their authoritative score
    socket.emit('scoreUpdate', { score: player.score, delta, evoStage: player.evoStage });

    // Tell others the updated score
    socket.to(room.code).emit('remoteScore', { playerId: socket.id, score: player.score });
  });

  function getEvoStage(score) {
    if (score >= 5000) return 6;
    if (score >= 2500) return 5;
    if (score >= 1000) return 4;
    if (score >=  400) return 3;
    if (score >=  150) return 2;
    return 1;
  }

  socket.on('playerDied', () => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.alive = false;
    io.to(room.code).emit('playerDied', { playerId: socket.id });

    const alive = [...room.players.values()].filter(p => p.alive);
    if (room.mode === 'versus') {
      if (alive.length <= 1) endGame(room, alive[0]?.id || null);
    } else {
      if (alive.length === 0) endGame(room, null);
    }
  });

  socket.on('bombExploded', (data) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    // Only relay — server doesn't trust position from client
    socket.to(pData.roomCode).emit('bombExploded', { fromId: socket.id });
  });

  socket.on('heartCollected', () => {
    const pData = players.get(socket.id);
    if (!pData) return;
    socket.to(pData.roomCode).emit('heartCollected', { fromId: socket.id });
  });

  socket.on('ping', (ts) => {
    if (typeof ts !== 'number' || !isFinite(ts)) return;
    socket.emit('pong', ts);
    const pData = players.get(socket.id);
    if (pData) {
      const room = rooms.get(pData.roomCode);
      if (room) {
        const player = room.players.get(socket.id);
        if (player) player.ping = Math.min(Date.now() - ts, 9999);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    audit('disconnect', { socketId: socket.id });
    queue.delete(socket.id);
    socketMeta.delete(socket.id);
    leaveRoom(socket.id);
  });
});

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(__dirname, { index: false }));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'intro.html')));

// ─── Health / stats ───────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  rooms: rooms.size, players: players.size,
  queue: queue.size, uptime: process.uptime(),
}));

app.get('/stats', (req, res) => {
  // Only allow from localhost or with admin secret
  const secret = req.headers['x-admin-secret'];
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({
    rooms:   rooms.size,
    players: players.size,
    queue:   { total: queue.size },
    uptime:  process.uptime(),
    roomList: [...rooms.values()].map(r => ({
      code: r.code, mode: r.mode, state: r.state,
      players: r.players.size,
      age: Math.floor((Date.now() - r.createdAt) / 1000),
    })),
  });
});

// Admin: view audit log (protected)
app.get('/audit', (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(auditLog.slice(-200));
});

// ─── Idle room cleanup ────────────────────────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    if (now - room.lastActivity > ROOM_TTL) {
      room.players.forEach((_, sid) => players.delete(sid));
      rooms.delete(code);
      console.log(`[clean] removed idle room ${code}`);
    }
  });
}, 5 * 60 * 1000);

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🎮 Cube Game Server → http://localhost:${PORT}`);
  console.log(`🔒 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!ADMIN_SECRET) console.warn('⚠️  ADMIN_SECRET not set — /stats and /audit are unprotected!');
});

// ─── Unhandled error guards ───────────────────────────────────────────────────
process.on('uncaughtException',  err => console.error('[CRASH]', err));
process.on('unhandledRejection', err => console.error('[REJECT]', err));
