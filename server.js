const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(express.static(__dirname));
app.use(express.json());

// ─── State ───────────────────────────────────────────────────────────────────

const rooms   = new Map();   // roomCode → Room
const queue   = new Map();   // socketId → { socket, mode, profile }
const players = new Map();   // socketId → { roomCode, ... }

const MAX_PLAYERS_PER_ROOM = 64;
const MATCHMAKING_INTERVAL = 2000; // ms
const MATCHMAKING_WAIT_MAX = 30000; // ms — after this, start with whoever is in queue
const ROOM_TTL = 30 * 60 * 1000;  // 30 min idle cleanup

// ─── Room factory ────────────────────────────────────────────────────────────

function createRoom(code, mode, hostId) {
  return {
    code,
    mode,          // 'coop' | 'versus'
    hostId,
    players: new Map(),  // socketId → PlayerState
    state: 'waiting',    // waiting | countdown | playing | ended
    createdAt: Date.now(),
    lastActivity: Date.now(),
    gameData: {
      sharedScore: 0,
      wave: 1,
      items: [],
      events: []
    }
  };
}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F9C1"
}

function roomPublicState(room) {
  const playerList = [...room.players.values()].map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    evoStage: p.evoStage,
    score: p.score,
    ready: p.ready,
    alive: p.alive,
    ping: p.ping
  }));
  return {
    code: room.code,
    mode: room.mode,
    state: room.state,
    hostId: room.hostId,
    players: playerList,
    gameData: room.gameData
  };
}

// ─── Matchmaking ─────────────────────────────────────────────────────────────

setInterval(() => {
  const now = Date.now();
  const coopQueue   = [...queue.values()].filter(e => e.mode === 'coop');
  const versusQueue = [...queue.values()].filter(e => e.mode === 'versus');

  [
    { entries: coopQueue,   mode: 'coop',   min: 2 },
    { entries: versusQueue, mode: 'versus', min: 2 }
  ].forEach(({ entries, mode, min }) => {
    // After MATCHMAKING_WAIT_MAX ms, start with whoever is waiting (even 1 player)
    const hasTimedOut = entries.length > 0 && entries.every(e => now - e.joinedAt >= MATCHMAKING_WAIT_MAX);
    const threshold = hasTimedOut ? 1 : min;

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

    // Broadcast updated queue positions to remaining waiters
    entries.forEach((entry, i) => {
      entry.socket.emit('queueStatus', { position: i + 1, mode, total: entries.length });
    });
  });
}, MATCHMAKING_INTERVAL);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function joinRoom(socket, code, profile) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) return { error: 'Room full' };
  if (room.state === 'playing') return { error: 'Game in progress' };

  socket.join(code);
  players.set(socket.id, { roomCode: code });

  const playerState = {
    id: socket.id,
    name: profile?.name || `Player${Math.floor(Math.random()*9999)}`,
    avatar: profile?.avatar || 'cube',
    evoStage: profile?.evoStage || 1,
    score: 0,
    ready: false,
    alive: true,
    ping: 0,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    inputs: {}
  };

  room.players.set(socket.id, playerState);
  room.lastActivity = Date.now();

  // Tell everyone in the room
  io.to(code).emit('playerJoined', {
    player: {
      id: playerState.id,
      name: playerState.name,
      avatar: playerState.avatar,
      evoStage: playerState.evoStage
    },
    roomState: roomPublicState(room)
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

  // Pass host if needed
  if (room.hostId === socketId && room.players.size > 0) {
    room.hostId = [...room.players.keys()][0];
    io.to(room.code).emit('hostChanged', { newHostId: room.hostId });
  }

  // Check if game should end (versus: 1 left; coop: all dead)
  if (room.state === 'playing') {
    const alive = [...room.players.values()].filter(p => p.alive);
    if (room.mode === 'versus' && alive.length <= 1) {
      endGame(room, alive[0]?.id || null);
    } else if (room.mode === 'coop' && alive.length === 0) {
      endGame(room, null);
    }
  }

  // Emit before possibly deleting the room
  io.to(room.code).emit('playerLeft', {
    playerId: socketId,
    roomState: roomPublicState(room)
  });

  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
}

function startCountdown(room) {
  room.state = 'countdown';
  let count = 3;
  io.to(room.code).emit('countdown', { count });

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(room.code).emit('countdown', { count });
    } else {
      clearInterval(timer);
      startGame(room);
    }
  }, 1000);
}

function startGame(room) {
  room.state = 'playing';
  room.gameData.startedAt = Date.now();
  // Reset all players
  room.players.forEach(p => {
    p.score = 0;
    p.alive = true;
    p.ready = false;
  });
  io.to(room.code).emit('gameStart', { roomState: roomPublicState(room) });
}

function endGame(room, winnerId) {
  room.state = 'ended';
  const scores = [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, evoStage: p.evoStage }))
    .sort((a, b) => b.score - a.score);

  io.to(room.code).emit('gameEnd', {
    winner: winnerId,
    scores,
    mode: room.mode,
    duration: Date.now() - (room.gameData.startedAt || room.createdAt)
  });
}

// ─── Socket handlers ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── Lobby ──────────────────────────────────────────────────────────────────

  socket.on('createRoom', ({ mode, profile }, cb) => {
    const code = generateCode();
    const room = createRoom(code, mode || 'versus', socket.id);
    rooms.set(code, room);
    const result = joinRoom(socket, code, profile);
    if (cb) cb({ ...result, code });
  });

  socket.on('joinRoom', ({ code, profile }, cb) => {
    const result = joinRoom(socket, code.toUpperCase(), profile);
    if (cb) cb(result);
  });

  socket.on('leaveRoom', () => leaveRoom(socket.id));

  socket.on('joinQueue', ({ mode, profile }) => {
    if (!queue.has(socket.id)) {
      queue.set(socket.id, { socket, mode: mode || 'versus', profile, joinedAt: Date.now() });
      socket.emit('queueStatus', {
        position: [...queue.values()].filter(e => e.mode === mode).length,
        mode
      });
    }
  });

  socket.on('leaveQueue', () => queue.delete(socket.id));

  socket.on('getRooms', (cb) => {
    // Public room browser (waiting rooms only)
    const list = [...rooms.values()]
      .filter(r => r.state === 'waiting' && r.players.size < MAX_PLAYERS_PER_ROOM)
      .map(r => ({
        code: r.code,
        mode: r.mode,
        playerCount: r.players.size,
        maxPlayers: MAX_PLAYERS_PER_ROOM,
        host: r.players.get(r.hostId)?.name || 'Unknown'
      }));
    if (cb) cb(list);
  });

  // ── In-lobby ───────────────────────────────────────────────────────────────

  socket.on('setReady', ({ ready }) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'waiting') return;

    const player = room.players.get(socket.id);
    if (player) player.ready = ready;

    io.to(room.code).emit('playerReady', { playerId: socket.id, ready, roomState: roomPublicState(room) });

    // Auto-start if all ready and ≥2
    const all = [...room.players.values()];
    if (all.length >= 2 && all.every(p => p.ready)) {
      startCountdown(room);
    }
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

  socket.on('chat', ({ message }) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    const sanitized = String(message).slice(0, 200).replace(/</g, '&lt;');
    io.to(room.code).emit('chat', {
      playerId: socket.id,
      name: player?.name || 'Unknown',
      message: sanitized,
      ts: Date.now()
    });
  });

  // ── In-game ────────────────────────────────────────────────────────────────

  // Client sends its input state every frame (or on change)
  socket.on('playerInput', (input) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    player.inputs = input;
    room.lastActivity = Date.now();
    // Broadcast to others for client-side prediction
    socket.to(room.code).emit('remoteInput', { playerId: socket.id, input });
  });

  // Authoritative position update from client (trust-lite — swap for server-auth later)
  socket.on('playerState', (state) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    if (state.position) player.position = state.position;
    if (state.velocity) player.velocity = state.velocity;
    if (typeof state.evoStage === 'number') player.evoStage = state.evoStage;
    if (typeof state.score === 'number') {
      player.score = state.score;
      if (room.mode === 'coop') {
        room.gameData.sharedScore = [...room.players.values()].reduce((s, p) => s + p.score, 0);
      }
    }
    room.lastActivity = Date.now();

    // Relay compact state to all others in room
    socket.to(room.code).emit('remoteState', {
      id: socket.id,
      position: player.position,
      velocity: player.velocity,
      evoStage: player.evoStage,
      score: player.score,
      alive: player.alive
    });
  });

  socket.on('playerDied', ({ killedBy }) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const player = room.players.get(socket.id);
    if (!player) return;

    player.alive = false;
    io.to(room.code).emit('playerDied', { playerId: socket.id, killedBy });

    const alive = [...room.players.values()].filter(p => p.alive);
    if (room.mode === 'versus') {
      if (alive.length <= 1) endGame(room, alive[0]?.id || null);
    } else {
      // coop: end when all dead
      if (alive.length === 0) endGame(room, null);
    }
  });

  socket.on('bombExploded', (data) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    socket.to(pData.roomCode).emit('bombExploded', { ...data, fromId: socket.id });
  });

  socket.on('heartCollected', (data) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    socket.to(pData.roomCode).emit('heartCollected', { ...data, fromId: socket.id });
  });

  socket.on('evoStageUp', ({ stage }) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player) player.evoStage = stage;
    socket.to(room.code).emit('remoteEvo', { playerId: socket.id, stage });
  });

  socket.on('gameEvent', (event) => {
    // Generic passthrough for mechanics.js events
    const pData = players.get(socket.id);
    if (!pData) return;
    socket.to(pData.roomCode).emit('gameEvent', { ...event, fromId: socket.id });
  });

  // ── Ping ───────────────────────────────────────────────────────────────────

  socket.on('ping', (ts) => {
    socket.emit('pong', ts);
    const pData = players.get(socket.id);
    if (pData) {
      const room = rooms.get(pData.roomCode);
      if (room) {
        const player = room.players.get(socket.id);
        if (player) player.ping = Date.now() - ts;
      }
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);
    queue.delete(socket.id);
    leaveRoom(socket.id);
  });
});

// ─── Admin / health ───────────────────────────────────────────────────────────

app.get('/health', (_, res) => res.json({
  rooms: rooms.size,
  players: players.size,
  queue: queue.size,
  uptime: process.uptime()
}));

app.get('/stats', (_, res) => {
  const roomList = [...rooms.values()].map(r => ({
    code: r.code,
    mode: r.mode,
    state: r.state,
    players: r.players.size,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    host: r.players.get(r.hostId)?.name || 'Unknown',
    age: Math.floor((Date.now() - r.createdAt) / 1000)
  }));
  res.json({
    rooms: rooms.size,
    players: players.size,
    queue: { total: queue.size, coop: [...queue.values()].filter(e => e.mode === 'coop').length, versus: [...queue.values()].filter(e => e.mode === 'versus').length },
    maxPlayersPerRoom: MAX_PLAYERS_PER_ROOM,
    uptime: process.uptime(),
    roomList
  });
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🎮  Cube multiplayer server → http://localhost:${PORT}`));
