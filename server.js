// server.js — CUBE GAME Secure Server (Security Hardened)
// Fixes: CORS, rate limiting, socket validation, anti-cheat, server-auth scores
// ============================================================================
'use strict';

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');
const admin    = require('firebase-admin');

const app    = express();
const server = http.createServer(app);

// ─── Environment Variables ────────────────────────────────────────────────────
// All secrets from env — never hardcoded
const PORT         = process.env.PORT         || 3000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || null; // must be set in Render
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : [
      'https://cubegame.club',
      'https://www.cubegame.club',
      'https://cube-game-fnam.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',   // VS Code "Live Server" default — local dev only
      'http://127.0.0.1:5500',
    ];

// Firebase client config — served to the browser via /config (never in static JS)
const FIREBASE_CLIENT_CONFIG = {
  apiKey:            process.env.FIREBASE_API_KEY        || null,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN    || null,
  projectId:         process.env.FIREBASE_PROJECT_ID     || null,
  appId:             process.env.FIREBASE_APP_ID         || null,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: process.env.FIREBASE_SENDER_ID      || null,
};

// ─── Firebase Admin SDK — server-side Firestore access ────────────────────────
// This is what makes payment records permanent. Everything written through
// this (not the client SDK) bypasses firestore.rules by design — it's the
// trusted server, same as the "server writes via Admin SDK" comments already
// in firestore.rules for leaderboard/scores. If FIREBASE_SERVICE_ACCOUNT_KEY
// isn't set, payments fall back to a local JSON file (see below) so the app
// still runs, but that file resets on every Render redeploy — set the env
// var for real persistence.
let db = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    console.log('🔥 Firestore connected — payments will persist permanently.');
  } else {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY not set — payments will only persist to a local file, which Render wipes on redeploy. Set this env var for real persistence.');
  }
} catch (e) {
  console.error('❌ Firebase Admin init failed — falling back to local file storage:', e.message);
  db = null;
}

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
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com; " +
    "connect-src 'self' wss: ws: https://*.firebaseapp.com https://*.googleapis.com https://cubegame.club https://www.cubegame.club https://pagead2.googlesyndication.com https://adservice.google.com; " +
    "img-src 'self' data: https://*.googleusercontent.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com; " +
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

// ─── Static files ─────────────────────────────────────────────────────────────
// Served BEFORE the rate limiter below. A single page load here pulls 50+
// files (every script tag, css, images, audio) — counting each one against
// the per-minute limiter meant a normal page load (or a couple of refreshes)
// could 429 itself out. Static files are cheap to serve and already covered
// by the security headers + CORS above; only dynamic/API requests that fall
// through (unmatched paths) hit the limiter from here on.
app.use(express.static(__dirname, { index: false }));

// ─── /config — Firebase client config injection ───────────────────────────────
// firebase-auth.js calls this on load and stores the result as
// window.__FIREBASE_CONFIG__ before initialising the Firebase SDK.
// This is the ONLY way the client ever sees these keys — they are never
// baked into static JS files.
app.get('/config', (req, res) => {
  if (!FIREBASE_CLIENT_CONFIG.apiKey) {
    // Not configured yet — return an empty object rather than erroring;
    // firebase-auth.js will log a warning and skip social login gracefully.
    return res.json({});
  }
  // Cache for 5 min (config doesn't change between deploys)
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json(FIREBASE_CLIENT_CONFIG);
});

// ─── HTTP Rate Limiting (no extra deps) ───────────────────────────────────────
const httpRateLimits = new Map(); // ip → { count, resetAt }
const HTTP_RATE_LIMIT = 180; // requests per minute per IP (API/socket routes only — see above)

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

// ─── Secret rewards ──────────────────────────────────────────────────────────
// No text field, no code to type — these are unlocked by finding an actual
// hidden trigger in the game itself (see secrets.js on the client, e.g. the
// Konami sequence or the logo click easter egg). The client only ever sends
// an internal secretId once the trigger fires; the actual reward values live
// ONLY here on the server, so view-source doesn't tell you what you get.
//
// To add a new secret: add an entry below, wire up its trigger in secrets.js,
// then redeploy. `item` (optional) must match an id in shop.js's
// ITEM_CATALOGUE (use an exclusive cost:Infinity entry so it shows as
// "🔒 EARN IT" in the shop until unlocked).
//   coins:      number of coins to grant (0/omit for none)
//   item:       item id to unlock, or null
//   label:      shown to the player in the reward popup
//   maxUses:    total unlocks allowed across all players, or null for unlimited
//   expiresAt:  ms timestamp after which the secret stops working, or null for never
const SECRET_REWARDS = {
  konami:     { coins: 500, item: 'skin_code_founder', label: 'Konami Code Found!',      maxUses: null, expiresAt: null },
  logoClicks: { coins: 150, item: null,                label: 'Logo Easter Egg Found!',  maxUses: null, expiresAt: null },
};

// Persisted so a redeploy/restart doesn't let everyone re-unlock "one-time"
// secrets. Structure: { secretId: { username: isoTimestamp, ... }, ... }
// NOTE: on Render this file lives on the container's ephemeral disk, so it
// will reset if the service is redeployed without a mounted volume. For
// long-lived rewards, attach a Render volume at this path (or migrate to
// Firestore) so unlock history survives deploys.
const SECRETS_FILE = path.join(__dirname, 'secrets-found.json');
let secretsFound = {};
try {
  if (fs.existsSync(SECRETS_FILE)) {
    secretsFound = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[secrets] could not load secrets-found.json — starting fresh:', e.message);
  secretsFound = {};
}

function saveSecretsFound() {
  try {
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secretsFound));
  } catch (e) {
    console.warn('[secrets] could not persist secrets-found.json:', e.message);
  }
}

// This endpoint is still callable directly (devtools, scripts), so it still
// needs its own tighter budget per IP — same idea as any other unauth'd
// reward endpoint, just no text to brute-force since secretIds are fixed.
const secretAttempts = new Map(); // ip → { count, resetAt }
const MAX_SECRET_ATTEMPTS = 8; // per 10 minutes per IP

function checkSecretRate(ip) {
  const now = Date.now();
  let r = secretAttempts.get(ip);
  if (!r || now > r.resetAt) {
    r = { count: 0, resetAt: now + 10 * 60_000 };
    secretAttempts.set(ip, r);
  }
  r.count++;
  return r.count <= MAX_SECRET_ATTEMPTS;
}
setInterval(() => {
  const now = Date.now();
  secretAttempts.forEach((v, k) => { if (now > v.resetAt) secretAttempts.delete(k); });
}, 10 * 60_000);

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
// ─── State ────────────────────────────────────────────────────────────────────
const rooms   = new Map();   // code → room
const queue   = new Map();   // socketId → queue entry (quick play)
const players = new Map();   // socketId → { roomCode }
const socketMeta = new Map(); // socketId → { ip, uid, rateBucket }

// ─── Team constants ────────────────────────────────────────────────────────────
// Multiplayer is Team Versus only: two teams, 1-4 players each, freely chosen.
// "1v1" through "4v4" are all the same room type — just a different team cap.
const MAX_TEAM_SIZE         = 4;   // hard cap per team
const MAX_PLAYERS_PER_ROOM  = MAX_TEAM_SIZE * 2; // 8
const MATCHMAKING_INTERVAL  = 2000;
const MATCHMAKING_WAIT_MAX  = 20000; // after this, match with whoever's queued
const ROOM_TTL              = 30 * 60 * 1000;
const TEAMS                 = ['A', 'B'];

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

function isValidTeamSize(n) {
  const v = parseInt(n, 10);
  return Number.isInteger(v) && v >= 1 && v <= MAX_TEAM_SIZE ? v : MAX_TEAM_SIZE;
}

function isValidTeam(t) {
  return TEAMS.includes(t) ? t : null;
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

function getEvoStage(score) {
  if (score >= 5000) return 6;
  if (score >= 2500) return 5;
  if (score >= 1000) return 4;
  if (score >=  400) return 3;
  if (score >=  150) return 2;
  return 1;
}

// ─── Room factory ─────────────────────────────────────────────────────────────
// Every room is Team Versus: Team A vs Team B, 1-4 players per side, players
// pick their own team. `teamSize` is the room's cap per side (1v1..4v4).
function createRoom(code, hostId, teamSize) {
  return {
    code,
    mode:         'versus',
    teamSize:     isValidTeamSize(teamSize),
    hostId,
    teams:        { A: new Map(), B: new Map() },
    state:        'waiting', // waiting | countdown | playing | ended
    quickPlay:    false,     // true if created by matchmaking (auto-starts)
    createdAt:    Date.now(),
    lastActivity: Date.now(),
    gameData:     { events: [] }
  };
}

function generateCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function teamOfSocket(room, socketId) {
  if (room.teams.A.has(socketId)) return 'A';
  if (room.teams.B.has(socketId)) return 'B';
  return null;
}

function teamCount(room, team) {
  return room.teams[team].size;
}

function roomPublicState(room) {
  const teamList = (team) => [...room.teams[team].values()].map(p => ({
    id:        p.id,
    name:      p.name,
    avatar:    p.avatar,
    evoStage:  p.evoStage,
    score:     p.score,
    ready:     p.ready,
    alive:     p.alive,
    ping:      p.ping,
    badgeIcon: p.badgeIcon || null,
    team:      p.team,
  }));
  return {
    code:      room.code,
    mode:      room.mode,
    teamSize:  room.teamSize,
    state:     room.state,
    hostId:    room.hostId,
    quickPlay: room.quickPlay,
    teams:     { A: teamList('A'), B: teamList('B') },
    gameData:  room.gameData,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Mirrors the badge icons in shop.js's ITEM_CATALOGUE — kept as an allow-list
// so a player can't just send any string as their "badge" over the socket.
// Whether they've actually *earned* the badge is still enforced client-side
// (localStorage), which is fine for a cosmetic flex badge but NOT something
// to rely on for anything with real value (see the coins/items note above).
const VALID_BADGE_ICONS = new Set(['🌟', '⚔️', '🏆', '🔮']);
function sanitizeBadgeIcon(icon) {
  return (typeof icon === 'string' && VALID_BADGE_ICONS.has(icon)) ? icon : null;
}

// Picks whichever team has fewer players (ties → A). Used for quick play,
// where the server assigns teams instead of the player choosing.
function autoTeam(room) {
  return teamCount(room, 'A') <= teamCount(room, 'B') ? 'A' : 'B';
}

function joinRoom(socket, code, requestedTeam, profile) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'waiting') return { error: 'Game already in progress' };
  if (teamOfSocket(room, socket.id)) return { error: 'Already in this room' };

  let team = isValidTeam(requestedTeam);
  if (team) {
    if (teamCount(room, team) >= room.teamSize) {
      // Requested team full — fall back to the other side if it has room.
      const other = team === 'A' ? 'B' : 'A';
      if (teamCount(room, other) < room.teamSize) team = other;
      else return { error: 'Room full' };
    }
  } else {
    team = autoTeam(room);
    if (teamCount(room, team) >= room.teamSize) return { error: 'Room full' };
  }

  socket.join(code);
  players.set(socket.id, { roomCode: code });

  const name = (profile?.name && isValidName(profile.name))
    ? profile.name : `Player${Math.floor(Math.random() * 9999)}`;

  const playerState = {
    id:        socket.id,
    name,
    avatar:    profile?.avatar || 'cube',
    evoStage:  1, // always start at 1 — server controls evo
    badgeIcon: sanitizeBadgeIcon(profile?.badgeIcon),
    team,
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

  room.teams[team].set(socket.id, playerState);
  room.lastActivity = Date.now();
  audit('playerJoined', { socketId: socket.id, name, room: code, team });

  io.to(code).emit('playerJoined', {
    player: { id: playerState.id, name: playerState.name, avatar: playerState.avatar, evoStage: playerState.evoStage, team },
    roomState: roomPublicState(room),
  });

  return { success: true, room: roomPublicState(room), team };
}

// Switch team pre-game (waiting state only). Returns {error} or {success}.
function switchTeam(socketId, requestedTeam) {
  const pData = players.get(socketId);
  if (!pData) return { error: 'Not in a room' };
  const room = rooms.get(pData.roomCode);
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'waiting') return { error: 'Game already started' };

  const from = teamOfSocket(room, socketId);
  const to   = isValidTeam(requestedTeam);
  if (!from || !to) return { error: 'Invalid team' };
  if (from === to) return { success: true, room: roomPublicState(room) };
  if (teamCount(room, to) >= room.teamSize) return { error: 'Team full' };

  const player = room.teams[from].get(socketId);
  room.teams[from].delete(socketId);
  player.team = to;
  player.ready = false;
  room.teams[to].set(socketId, player);
  room.lastActivity = Date.now();

  io.to(room.code).emit('teamChanged', { playerId: socketId, team: to, roomState: roomPublicState(room) });
  return { success: true, room: roomPublicState(room) };
}

function leaveRoom(socketId) {
  const pData = players.get(socketId);
  if (!pData) return;
  const room = rooms.get(pData.roomCode);
  if (!room) return;

  const team = teamOfSocket(room, socketId);
  if (!team) return;
  room.teams[team].delete(socketId);
  players.delete(socketId);

  const remaining = [...room.teams.A.keys(), ...room.teams.B.keys()];

  if (room.hostId === socketId && remaining.length > 0) {
    room.hostId = remaining[0];
    io.to(room.code).emit('hostChanged', { newHostId: room.hostId });
  }

  if (room.state === 'playing') {
    const aliveA = [...room.teams.A.values()].filter(p => p.alive).length;
    const aliveB = [...room.teams.B.values()].filter(p => p.alive).length;
    if (room.teams.A.size === 0 || aliveA === 0) endGame(room, room.teams.B.size ? 'B' : null);
    else if (room.teams.B.size === 0 || aliveB === 0) endGame(room, room.teams.A.size ? 'A' : null);
  }

  io.to(room.code).emit('playerLeft', { playerId: socketId, roomState: roomPublicState(room) });
  if (remaining.length === 0) rooms.delete(room.code);
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
  [...room.teams.A.values(), ...room.teams.B.values()].forEach(p => {
    p.score = 0; p.coins = 0;
    p.alive = true; p.ready = false;
    p.evoStage = 1; p.flagCount = 0;
  });
  io.to(room.code).emit('gameStart', { roomState: roomPublicState(room) });
}

async function endGame(room, winnerTeam) {
  if (room.state === 'ended') return;
  room.state = 'ended';

  const scoreOf = (team) => [...room.teams[team].values()].reduce((s, p) => s + p.score, 0);
  const teamScores = { A: scoreOf('A'), B: scoreOf('B') };

  const scores = [...room.teams.A.values(), ...room.teams.B.values()]
    .map(p => ({ id: p.id, name: p.name, team: p.team, score: p.score, evoStage: p.evoStage, coins: p.coins }))
    .sort((a, b) => b.score - a.score);

  const matchStart = room.gameData.startedAt || room.createdAt;

  // Server decides coin rewards — winning team gets a bigger bonus. Credited
  // to the real wallet (not just told to the client to self-apply) so a
  // match win actually counts toward what the shop will let you spend.
  scores.forEach((p) => {
    const onWinner = winnerTeam && p.team === winnerTeam;
    const bonus = onWinner ? 50 : 10;
    const coinReward = Math.floor(p.score / 100) + bonus;
    io.to(p.id).emit('gameReward', {
      coinsEarned: coinReward,
      trophyChange: onWinner ? 30 : -10,
    });
    if (isValidName(p.name)) {
      creditWallet(p.name, coinReward, `mp:${room.code}:${matchStart}:${p.id}`, { method: 'multiplayer', room: room.code })
        .catch(e => console.error('[wallet] multiplayer credit failed:', e.message));
    }
    audit('gameReward', { socketId: p.id, name: p.name, coins: coinReward, score: p.score });
  });

  io.to(room.code).emit('gameEnd', {
    winnerTeam,
    teamScores,
    scores,
    mode:     room.mode,
    teamSize: room.teamSize,
    duration: Date.now() - (room.gameData.startedAt || room.createdAt),
  });
}

// ─── Matchmaking (quick play) ──────────────────────────────────────────────────
// Players queue for a specific match size (1v1 / 2v2 / 3v3 / 4v4). Once enough
// players are waiting for that size, the first half are auto-placed on Team A
// and the second half on Team B, and the match starts immediately.
//
// runMatchmaking() is called both immediately — whenever someone joins/leaves
// the queue, so a room is "found" the instant a second player shows up
// instead of waiting for the next poll tick — and on a slower interval as a
// safety net (to catch the MATCHMAKING_WAIT_MAX timeout case).
function runMatchmaking() {
  const now = Date.now();

  for (let size = 1; size <= MAX_TEAM_SIZE; size++) {
    const entries = [...queue.values()].filter(e => e.size === size);
    if (entries.length === 0) continue;

    const need = size * 2;
    const oldestWait = now - Math.min(...entries.map(e => e.joinedAt));
    const timedOut = oldestWait >= MATCHMAKING_WAIT_MAX && entries.length >= 2;

    if (entries.length >= need || timedOut) {
      // If timed out early, match with however many are here (split as evenly
      // as possible, capped at `size` per team) rather than making them wait forever.
      const takeTotal = Math.min(entries.length, need);
      const perSide = timedOut && takeTotal < need ? Math.floor(takeTotal / 2) : size;
      if (perSide < 1) continue;

      const batch = entries.slice(0, perSide * 2);
      const code  = generateCode();
      const room  = createRoom(code, batch[0].socket.id, perSide);
      room.quickPlay = true;
      rooms.set(code, room);

      batch.forEach((entry, i) => {
        queue.delete(entry.socket.id);
        const team = i < perSide ? 'A' : 'B';
        joinRoom(entry.socket, code, team, entry.profile);
      });

      io.to(code).emit('matchFound', { code, mode: 'versus', teamSize: perSide });
      startCountdown(room);
      continue; // this size's queue just got consumed — skip status broadcast below
    }

    entries.forEach((entry, i) => {
      entry.socket.emit('queueStatus', { position: i + 1, size, total: entries.length });
    });
  }
}

setInterval(runMatchmaking, MATCHMAKING_INTERVAL);

// Stale room cleanup
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL) rooms.delete(code);
  }
}, 5 * 60 * 1000);

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

  // ── Lobby: room creation / joining ─────────────────────────────────────────
  socket.on('createRoom', ({ teamSize, profile } = {}, cb) => {
    const size = isValidTeamSize(teamSize);
    const code = generateCode();
    const room = createRoom(code, socket.id, size);
    rooms.set(code, room);
    const result = joinRoom(socket, code, 'A', profile);
    if (typeof cb === 'function') cb({ ...result, code, teamSize: size });
  });

  socket.on('joinRoom', ({ code, team, profile } = {}, cb) => {
    if (typeof code !== 'string') {
      if (typeof cb === 'function') cb({ error: 'Invalid code' });
      return;
    }
    const result = joinRoom(socket, code.toUpperCase().slice(0, 8), team, profile);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('switchTeam', ({ team } = {}, cb) => {
    const result = switchTeam(socket.id, team);
    if (typeof cb === 'function') cb(result);
  });

  socket.on('leaveRoom', () => leaveRoom(socket.id));

  // ── Lobby: quick play matchmaking ────────────────────────────────────────
  // size = 1..4, meaning "queue for a 1v1", "queue for a 2v2", etc.
  socket.on('joinQueue', ({ size, profile } = {}) => {
    const validSize = isValidTeamSize(size);
    if (!queue.has(socket.id)) {
      queue.set(socket.id, { socket, size: validSize, profile, joinedAt: Date.now() });
      const sameSize = [...queue.values()].filter(e => e.size === validSize);
      socket.emit('queueStatus', {
        position: sameSize.length,
        size: validSize,
        total: sameSize.length,
      });
      // Check for a match right away — don't make a waiting player sit
      // through up to MATCHMAKING_INTERVAL ms before the room is found.
      runMatchmaking();
    }
  });

  socket.on('leaveQueue', () => queue.delete(socket.id));

  socket.on('getRooms', (cb) => {
    const list = [...rooms.values()]
      .filter(r => r.state === 'waiting' && !r.quickPlay)
      .map(r => ({
        code:        r.code,
        teamSize:    r.teamSize,
        teamACount:  r.teams.A.size,
        teamBCount:  r.teams.B.size,
        maxPlayers:  r.teamSize * 2,
        host:        r.teams.A.get(r.hostId)?.name || r.teams.B.get(r.hostId)?.name || 'Unknown',
      }));
    if (typeof cb === 'function') cb(list);
  });

  // ── In-lobby ─────────────────────────────────────────────────────────────
  socket.on('setReady', ({ ready } = {}) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'waiting') return;
    const team = teamOfSocket(room, socket.id);
    if (!team) return;
    const player = room.teams[team].get(socket.id);
    if (player) player.ready = !!ready;

    io.to(room.code).emit('playerReady', {
      playerId: socket.id, ready: !!ready, roomState: roomPublicState(room),
    });

    const all = [...room.teams.A.values(), ...room.teams.B.values()];
    const bothTeamsFilled = room.teams.A.size > 0 && room.teams.A.size === room.teams.B.size;
    if (bothTeamsFilled && all.length >= 2 && all.every(p => p.ready)) startCountdown(room);
  });

  socket.on('hostStartGame', () => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.hostId !== socket.id || room.state !== 'waiting') return;
    if (room.teams.A.size < 1 || room.teams.B.size < 1) {
      socket.emit('error', { message: 'Both teams need at least 1 player' });
      return;
    }
    if (room.teams.A.size !== room.teams.B.size) {
      socket.emit('error', { message: 'Teams must be even — same number of players on each side' });
      return;
    }
    startCountdown(room);
  });

  socket.on('chat', ({ message } = {}) => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room) return;
    const team = teamOfSocket(room, socket.id);
    const player = team ? room.teams[team].get(socket.id) : null;
    const sanitized = sanitizeText(message, 200);
    if (!sanitized) return;

    io.to(room.code).emit('chat', {
      playerId: socket.id,
      name:     player?.name || 'Unknown',
      team:     team || null,
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
    const team = teamOfSocket(room, socket.id);
    const player = team ? room.teams[team].get(socket.id) : null;
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
    const team = teamOfSocket(room, socket.id);
    const player = team ? room.teams[team].get(socket.id) : null;
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
      team:     player.team,
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
    const team = teamOfSocket(room, socket.id);
    const player = team ? room.teams[team].get(socket.id) : null;
    if (!player || !player.alive) return;

    // Server calculates score — never trusting client score
    const { delta, valid } = calculateScoreDelta(event, player);
    if (!valid) {
      audit('cheat:score', { socketId: socket.id, name: player.name, event });
      return;
    }

    player.score += delta;

    // Check evo stage based on server score
    const newEvo = getEvoStage(player.score);
    if (newEvo !== player.evoStage) {
      player.evoStage = newEvo;
      io.to(room.code).emit('remoteEvo', { playerId: socket.id, stage: newEvo });
    }

    // Tell the scoring player their authoritative score
    socket.emit('scoreUpdate', { score: player.score, delta, evoStage: player.evoStage });

    // Tell others the updated score
    socket.to(room.code).emit('remoteScore', { playerId: socket.id, team: player.team, score: player.score });
  });

  socket.on('playerDied', () => {
    const pData = players.get(socket.id);
    if (!pData) return;
    const room = rooms.get(pData.roomCode);
    if (!room || room.state !== 'playing') return;
    const team = teamOfSocket(room, socket.id);
    const player = team ? room.teams[team].get(socket.id) : null;
    if (!player) return;

    player.alive = false;
    io.to(room.code).emit('playerDied', { playerId: socket.id, team: player.team });

    // Team is eliminated once every member on that team is dead.
    const aliveA = [...room.teams.A.values()].filter(p => p.alive).length;
    const aliveB = [...room.teams.B.values()].filter(p => p.alive).length;
    if (aliveA === 0 && aliveB === 0) endGame(room, null); // draw
    else if (aliveA === 0) endGame(room, 'B');
    else if (aliveB === 0) endGame(room, 'A');
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
        const team = teamOfSocket(room, socket.id);
        const player = team ? room.teams[team].get(socket.id) : null;
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
// ─── Secret unlock endpoint ─────────────────────────────────────────────────────
// Client sends { username, secretId } once it detects the actual hidden
// trigger in-game (see secrets.js). Server is the sole source of truth for
// whether that secret is real, still active, and not already claimed by this
// player — the client never knows the reward values, only the result.
app.post('/api/secret/unlock', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;
  if (!checkSecretRate(ip)) {
    audit('secret:rateLimited', { ip });
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }

  const { username, secretId } = req.body || {};
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  if (typeof secretId !== 'string' || !secretId.trim()) {
    return res.status(400).json({ error: 'Missing secret id.' });
  }

  const normId = secretId.trim().slice(0, 40);
  const reward = SECRET_REWARDS[normId];
  if (!reward) {
    audit('secret:invalid', { ip, username: sanitizeText(username, 24), secretId: normId });
    return res.status(404).json({ error: 'Unknown secret.' });
  }
  if (reward.expiresAt && Date.now() > reward.expiresAt) {
    return res.status(410).json({ error: 'This secret is no longer active.' });
  }

  if (!secretsFound[normId]) secretsFound[normId] = {};
  const finders = secretsFound[normId];

  if (finders[username]) {
    return res.status(409).json({ error: 'You already found this secret.' });
  }
  if (reward.maxUses && Object.keys(finders).length >= reward.maxUses) {
    return res.status(410).json({ error: 'This secret has reached its unlock limit.' });
  }

  finders[username] = new Date().toISOString();
  saveSecretsFound();

  // Credit the server wallet too — not just the client-applied response —
  // so this coin grant actually counts toward what the shop will let you
  // spend, the same as a real payment does.
  if (reward.coins) {
    await creditWallet(username, reward.coins, `secret:${normId}:${username}`, { method: 'secret', secretId: normId });
  }

  audit('secret:success', {
    ip, username: sanitizeText(username, 24), secretId: normId,
    coins: reward.coins || 0, item: reward.item || null,
  });

  res.json({
    success:  true,
    secretId: normId,
    coins:    reward.coins || 0,
    item:     reward.item  || null,
    label:    reward.label || 'Secret Found!',
  });
});

// ─── Wallet ledger (server-confirmed coin purchases) ────────────────────────
// This is the single source of truth for "coins actually paid for". The
// client (shop.js) never gets to grant itself coins for a real-money
// purchase — it only polls /api/wallet/:username and locally applies
// whatever this says is confirmed.
//
// Primary storage: Firestore (`wallets/{username}` for the running balance,
// `payments/{txnId}` as a permanent record of every individual payment —
// method, amount, coins, when). This is what makes payments actually
// remembered: it survives redeploys, server restarts, everything.
//
// If FIREBASE_SERVICE_ACCOUNT_KEY isn't set, this falls back to a local
// wallet-ledger.json file so the shop still works — but that file lives on
// Render's ephemeral disk and resets on redeploy. Set the env var for real,
// permanent memory of payments.
const WALLET_FILE = path.join(__dirname, 'wallet-ledger.json');
let walletLocal = {}; // { username: { coins: number, txns: [txnId, ...] } } — fallback only
try {
  if (fs.existsSync(WALLET_FILE)) {
    walletLocal = JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[wallet] could not load wallet-ledger.json — starting fresh:', e.message);
  walletLocal = {};
}
function saveWalletLocal() {
  try {
    fs.writeFileSync(WALLET_FILE, JSON.stringify(walletLocal));
  } catch (e) {
    console.warn('[wallet] could not persist wallet-ledger.json:', e.message);
  }
}
function creditWalletLocal(username, coins, txnId) {
  if (!walletLocal[username]) walletLocal[username] = { coins: 0, txns: [] };
  if (txnId && walletLocal[username].txns.includes(txnId)) return false; // already credited — don't double-pay
  walletLocal[username].coins += coins;
  if (txnId) walletLocal[username].txns.push(txnId);
  saveWalletLocal();
  return true;
}

// Credits `coins` to `username`, permanently recording this exact payment
// (keyed by txnId, so retries/duplicate webhooks can never double-pay).
// meta: { method: 'paypal'|'metamask', amount, currency }
async function creditWallet(username, coins, txnId, meta = {}) {
  if (db) {
    try {
      const paymentRef = txnId ? db.collection('payments').doc(txnId) : db.collection('payments').doc();
      const walletRef  = db.collection('wallets').doc(username);
      return await db.runTransaction(async (t) => {
        if (txnId) {
          const paymentDoc = await t.get(paymentRef);
          if (paymentDoc.exists) return false; // this exact payment was already recorded
        }
        const walletDoc = await t.get(walletRef);
        const currentCoins = walletDoc.exists ? (walletDoc.data().coins || 0) : 0;
        t.set(walletRef, {
          username, coins: currentCoins + coins,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        t.set(paymentRef, {
          username, coins, txnId: txnId || null,
          method:   meta.method   || 'unknown',
          amount:   meta.amount   ?? null,
          currency: meta.currency ?? null,
          creditedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });
    } catch (e) {
      console.error('[wallet] Firestore credit failed, falling back to local file:', e.message);
      return creditWalletLocal(username, coins, txnId);
    }
  }
  return creditWalletLocal(username, coins, txnId);
}

async function getWalletBalance(username) {
  if (db) {
    try {
      const doc = await db.collection('wallets').doc(username).get();
      return doc.exists ? (doc.data().coins || 0) : 0;
    } catch (e) {
      console.error('[wallet] Firestore read failed, falling back to local file:', e.message);
    }
  }
  return (walletLocal[username] && walletLocal[username].coins) || 0;
}

// ─── Shop spend gate (anti-cheat) ──────────────────────────────────────────
// Problem: user.coins lives in localStorage, so anyone can open devtools and
// type `coins = 9999999` (or edit cg_current_user directly) to give
// themselves a fake balance. shop.js used to trust that number completely
// when deciding whether a purchase was allowed — so that fake balance could
// buy real items.
//
// Fix: purchases are now gated by THIS server-side wallet balance, which the
// client can never write to directly — only server code (creditWallet)
// increments it, in response to something the server itself verified
// (a real payment, a real secret unlock, a real multiplayer win, or a
// rate-limited/capped report of single-player earnings — see
// /api/coins/earn below). Inflating localStorage still inflates what the
// UI *shows*, but the instant that balance is asked to actually buy
// something, it's checked against this number instead — and rejected if
// it doesn't hold up.
//
// Known limitation: chest loot and mission/reward-table coins are still
// applied purely client-side for now (replicating those RNG/gating tables
// server-side is a bigger follow-up project) — so an honest player's real
// balance may undercount slightly vs. what they've legitimately earned
// until that's migrated too. That's a UX gap, not a security hole: it just
// means the server errs on the side of rejecting, never on trusting the
// client.
const SHOP_ITEM_COSTS = {
  trail_neon: 150, trail_fire: 250, trail_thunder: 400, trail_void: 600,
  trail_rainbow: 900, trail_ice: 350, trail_gold: 750, trail_shadow: 550,
  skin_royal: 800, skin_diamond: 1200, skin_lava: 950, skin_galaxy: 1500,
  skin_ghost: 700, skin_emerald: 1100, skin_neon_grid: 1800, skin_inferno: 2000,
  power_slowmo: 300, power_explode: 500, power_shield: 1000, power_magnet: 1400,
  power_x2score: 1200, power_freeze: 800, power_ghost2: 1600, power_time: 900,
  badge_rookie: 100, badge_slayer: 500, badge_legend: 2500, badge_void: 3000,
  // skin_code_founder is intentionally absent — cost:Infinity in shop.js,
  // meaning it can only ever come from /api/secret/unlock, never bought.
};

const UNLOCKS_FILE = path.join(__dirname, 'unlocks-ledger.json');
let unlocksLocal = {}; // { username: [itemId, ...] } — fallback only
try {
  if (fs.existsSync(UNLOCKS_FILE)) {
    unlocksLocal = JSON.parse(fs.readFileSync(UNLOCKS_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[unlocks] could not load unlocks-ledger.json — starting fresh:', e.message);
  unlocksLocal = {};
}
function saveUnlocksLocal() {
  try { fs.writeFileSync(UNLOCKS_FILE, JSON.stringify(unlocksLocal)); }
  catch (e) { console.warn('[unlocks] could not persist unlocks-ledger.json:', e.message); }
}

async function getUnlocks(username) {
  if (db) {
    try {
      const doc = await db.collection('unlocks').doc(username).get();
      return doc.exists ? (doc.data().items || []) : [];
    } catch (e) {
      console.error('[unlocks] Firestore read failed, falling back to local file:', e.message);
    }
  }
  return unlocksLocal[username] || [];
}

// Atomically: verify the item exists + isn't already owned, check balance,
// deduct, record ownership. Returns { success, balance, reason? }.
async function debitWalletForItem(username, itemId) {
  const cost = SHOP_ITEM_COSTS[itemId];
  if (!cost) return { success: false, reason: 'unknown_item' };

  if (db) {
    try {
      const walletRef  = db.collection('wallets').doc(username);
      const unlockRef  = db.collection('unlocks').doc(username);
      return await db.runTransaction(async (t) => {
        const [walletDoc, unlockDoc] = await Promise.all([t.get(walletRef), t.get(unlockRef)]);
        const balance = walletDoc.exists ? (walletDoc.data().coins || 0) : 0;
        const owned   = unlockDoc.exists ? (unlockDoc.data().items || []) : [];

        if (owned.includes(itemId)) return { success: false, reason: 'already_owned', balance };
        if (balance < cost) return { success: false, reason: 'insufficient_funds', balance };

        const newBalance = balance - cost;
        t.set(walletRef, { username, coins: newBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        t.set(unlockRef, { username, items: [...owned, itemId], updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return { success: true, balance: newBalance, itemId };
      });
    } catch (e) {
      console.error('[wallet] Firestore debit failed, falling back to local file:', e.message);
    }
  }

  // Local-file fallback (dev / no Firestore configured)
  const balance = (walletLocal[username] && walletLocal[username].coins) || 0;
  const owned   = unlocksLocal[username] || [];
  if (owned.includes(itemId)) return { success: false, reason: 'already_owned', balance };
  if (balance < cost) return { success: false, reason: 'insufficient_funds', balance };

  walletLocal[username] = walletLocal[username] || { coins: 0, txns: [] };
  walletLocal[username].coins = balance - cost;
  unlocksLocal[username] = [...owned, itemId];
  saveWalletLocal();
  saveUnlocksLocal();
  return { success: true, balance: walletLocal[username].coins, itemId };
}

// ─── Rate-limited single-player coin reporting ─────────────────────────────
// Single-player score, chests, and missions are computed entirely client
// side today (no server session to verify against). Rather than trust
// whatever number the client claims outright, each report is capped to the
// largest legitimate single reward in the game (a Legendary chest tops out
// at 3000) and rate-limited per player — so even a scripted/console loop
// calling this over and over can only trickle coins in slowly, nowhere near
// fast enough to matter, instead of minting millions instantly.
const EARN_MAX_PER_CALL = 3000;
const EARN_MAX_CALLS_PER_WINDOW = 20;
const EARN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const earnRateBuckets = new Map(); // username → { count, resetAt }

function checkEarnRate(username) {
  const now = Date.now();
  let bucket = earnRateBuckets.get(username);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + EARN_WINDOW_MS };
    earnRateBuckets.set(username, bucket);
  }
  bucket.count++;
  return bucket.count <= EARN_MAX_CALLS_PER_WINDOW;
}

// Full payment history for a player — used for support/dispute lookups
// (e.g. "I paid but didn't get coins") rather than by the game client.
async function getPaymentHistory(username) {
  if (!db) return null; // history isn't available in local-file fallback mode
  const snap = await db.collection('payments').where('username', '==', username)
    .orderBy('creditedAt', 'desc').limit(100).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Daily streak ledger (account-wide, server clock, cross-device) ────────
// The streak counter used to live only in the client's localStorage
// progression save, which meant switching devices (or clearing site data)
// silently reset it, and a player could "farm" extra check-ins by just
// changing their device clock. This ledger is keyed by username (same
// identity used by the wallet above) so the streak — and whether today's
// reward has already been claimed — is the same everywhere that account
// logs in, and the day boundary is computed from the SERVER's clock, not
// the client's.
//
// Storage: Firestore (`streaks/{username}`) when available, else a local
// streak-ledger.json file (ephemeral on Render redeploys, same caveat as
// the wallet fallback above).
const STREAK_FILE = path.join(__dirname, 'streak-ledger.json');
let streakLocal = {}; // { username: { count, longest, lastCheckIn, claimedUpTo } } — fallback only
try {
  if (fs.existsSync(STREAK_FILE)) {
    streakLocal = JSON.parse(fs.readFileSync(STREAK_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[streak] could not load streak-ledger.json — starting fresh:', e.message);
  streakLocal = {};
}
function saveStreakLocal() {
  try {
    fs.writeFileSync(STREAK_FILE, JSON.stringify(streakLocal));
  } catch (e) {
    console.warn('[streak] could not persist streak-ledger.json:', e.message);
  }
}

// UTC calendar day, deliberately NOT the player's local timezone — using a
// fixed reference means the day boundary is identical no matter which
// device/timezone the player checks in from, so it can't be gamed by
// switching devices across a timezone line.
function todayUTCKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function utcDaysBetween(aKey, bKey) {
  const a = Date.parse(aKey + 'T00:00:00Z');
  const b = Date.parse(bKey + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

// Pure state-transition function shared by both the Firestore and local-file
// paths, so the two storage backends can never disagree on the rules.
//
// `count` only tracks whether the streak is alive — it does NOT grant
// anything by itself. `claimedUpTo` is a separate watermark: any day whose
// number is > claimedUpTo and <= count is "unlocked but not yet claimed".
// That's what lets a player who checks in three days in a row without
// opening the reward screen still get all three rewards later — nothing is
// lost just because they didn't tap Claim right away. Breaking the streak
// (missing a full day) starts a fresh cycle and clears the watermark, since
// a new streak means a new set of days to earn.
function advanceStreak(prev, today) {
  const s = {
    count: prev.count || 0,
    longest: prev.longest || 0,
    lastCheckIn: prev.lastCheckIn || null,
    claimedUpTo: prev.claimedUpTo || 0,
  };
  if (s.lastCheckIn === today) {
    return { streak: s, alreadyCheckedIn: true };
  }
  if (s.lastCheckIn) {
    const gap = utcDaysBetween(s.lastCheckIn, today);
    if (gap === 1) {
      s.count += 1;
    } else if (gap > 1) {
      s.count = 1;
      s.claimedUpTo = 0; // streak broke — start a fresh cycle
    }
  } else {
    s.count = 1; // very first check-in ever
  }
  s.lastCheckIn = today;
  s.longest = Math.max(s.longest, s.count);
  return { streak: s, alreadyCheckedIn: false };
}

// Unlocks today's day (advances `count`) but does NOT grant a reward.
// Returns { count, longest, lastCheckIn, alreadyCheckedIn, day, cycle, pendingCount }.
// `pendingCount` tells the client how many unclaimed days are waiting.
async function checkInStreak(username) {
  const today = todayUTCKey();

  if (db) {
    try {
      const ref = db.collection('streaks').doc(username);
      const result = await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const prev = doc.exists ? doc.data() : {};
        const { streak, alreadyCheckedIn } = advanceStreak(prev, today);
        if (!alreadyCheckedIn) {
          t.set(ref, { username, ...streak, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        return { streak, alreadyCheckedIn };
      });
      return finishStreakResult(result);
    } catch (e) {
      console.error('[streak] Firestore check-in failed, falling back to local file:', e.message);
    }
  }

  const prev = streakLocal[username] || {};
  const { streak, alreadyCheckedIn } = advanceStreak(prev, today);
  if (!alreadyCheckedIn) {
    streakLocal[username] = streak;
    saveStreakLocal();
  }
  return finishStreakResult({ streak: streakLocal[username] || streak, alreadyCheckedIn });
}

// Claims every unlocked-but-unclaimed day in one shot (days claimedUpTo+1
// through count), moves the watermark up to `count`, and hands back the
// list so the client can grant each one's reward. Calling this with nothing
// pending just returns an empty `claimed` array — harmless no-op.
async function claimStreak(username) {
  if (db) {
    try {
      const ref = db.collection('streaks').doc(username);
      const result = await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const prev = doc.exists ? doc.data() : {};
        const claim = buildClaim(prev);
        if (claim.claimed.length) {
          t.set(ref, { claimedUpTo: claim.claimedUpTo, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        return claim;
      });
      return result;
    } catch (e) {
      console.error('[streak] Firestore claim failed, falling back to local file:', e.message);
    }
  }

  const prev = streakLocal[username] || {};
  const result = buildClaim(prev);
  if (result.claimed.length) {
    streakLocal[username] = { ...prev, claimedUpTo: result.claimedUpTo };
    saveStreakLocal();
  }
  return result;
}

// Shared by both storage backends: figures out which days (by absolute
// streak count) are unlocked but not yet claimed.
function buildClaim(prev) {
  const count = prev.count || 0;
  const claimedUpTo = prev.claimedUpTo || 0;
  const claimed = [];
  for (let n = claimedUpTo + 1; n <= count; n++) {
    claimed.push({ count: n, day: ((n - 1) % 7) + 1, cycle: Math.floor((n - 1) / 7) + 1 });
  }
  return { claimed, count, longest: prev.longest || 0, claimedUpTo: count };
}

function finishStreakResult({ streak, alreadyCheckedIn }) {
  const day = ((streak.count - 1) % 7) + 1;
  const cycle = Math.floor((streak.count - 1) / 7) + 1;
  const pendingCount = Math.max(0, streak.count - (streak.claimedUpTo || 0));
  return { count: streak.count, longest: streak.longest, lastCheckIn: streak.lastCheckIn, alreadyCheckedIn, day, cycle, pendingCount };
}

// Coins-can't-buy-the-count check happens client-side (coin balance is the
// existing local/shop.js currency, not a server-verified balance — same as
// every other in-game coin spend in this project). This endpoint's job is
// just to advance the account-wide streak `count` directly, bypassing the
// once-per-calendar-day gate, so a paid skip is just as cross-device-safe
// as an ordinary check-in. `days` is capped server-side regardless of what
// the client sends, so a tampered request can't jump the streak by 1000.
const STREAK_UNLOCK_MAX_DAYS = 3;
async function unlockStreakDays(username, days) {
  days = Math.max(1, Math.min(STREAK_UNLOCK_MAX_DAYS, Math.trunc(days)));
  const today = todayUTCKey();

  if (db) {
    try {
      const ref = db.collection('streaks').doc(username);
      const streak = await db.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const prev = doc.exists ? doc.data() : {};
        const next = {
          count: (prev.count || 0) + days,
          claimedUpTo: prev.claimedUpTo || 0,
          lastCheckIn: today, // treat the skip as covering today too, so tomorrow's normal check-in still sees a 1-day gap
        };
        next.longest = Math.max(prev.longest || 0, next.count);
        t.set(ref, { username, ...next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return next;
      });
      return finishStreakResult({ streak, alreadyCheckedIn: false });
    } catch (e) {
      console.error('[streak] Firestore unlock failed, falling back to local file:', e.message);
    }
  }

  const prev = streakLocal[username] || {};
  const streak = {
    count: (prev.count || 0) + days,
    claimedUpTo: prev.claimedUpTo || 0,
    lastCheckIn: today,
  };
  streak.longest = Math.max(prev.longest || 0, streak.count);
  streakLocal[username] = streak;
  saveStreakLocal();
  return finishStreakResult({ streak, alreadyCheckedIn: false });
}


// says was actually paid matches what the coin count claims to cost, so a
// tampered `custom` field (e.g. claiming 25000 coins on a $0.39 payment)
// gets rejected instead of credited.
const COIN_PACKS = {
  50: 0.39, 200: 1.49, 600: 3.79, 1500: 7.49,
  4000: 14.99, 10000: 37.49, 25000: 89.99,
};
const PAYPAL_EMAIL = process.env.PAYPAL_EMAIL || null;

// ─── PayPal IPN — verifies payment with PayPal itself before crediting ──────
// Flow: PayPal POSTs the payment notification here → we re-POST the exact
// same body back to PayPal with cmd=_notify-validate prepended → PayPal
// replies "VERIFIED" or "INVALID". Only a VERIFIED, Completed payment to the
// correct business email, for the correct amount, gets credited — and only
// once per txn_id. This endpoint receives PayPal's own form-encoded POST,
// not JSON, so it needs its own body parser separate from the global one.
app.post('/api/paypal/ipn', express.urlencoded({ extended: false, limit: '16kb' }), async (req, res) => {
  // Always 200 immediately so PayPal doesn't retry-storm us; verification
  // happens async afterward.
  res.sendStatus(200);

  try {
    if (!PAYPAL_EMAIL) {
      console.warn('[paypal-ipn] PAYPAL_EMAIL not configured — cannot verify, ignoring notification');
      return;
    }

    const body = req.body || {};
    const verifyBody = 'cmd=_notify-validate&' + new URLSearchParams(body).toString();

    const verifyRes = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody,
    });
    const verdict = await verifyRes.text();

    if (verdict.trim() !== 'VERIFIED') {
      audit('paypal:invalid', { verdict, txn_id: body.txn_id || null });
      return;
    }

    if (body.payment_status !== 'Completed') {
      audit('paypal:notCompleted', { status: body.payment_status, txn_id: body.txn_id || null });
      return;
    }

    if ((body.receiver_email || '').toLowerCase() !== PAYPAL_EMAIL.toLowerCase()) {
      audit('paypal:wrongReceiver', { receiver: body.receiver_email, txn_id: body.txn_id || null });
      return;
    }

    // custom field was set client-side as "user:<username>|coins:<coins>"
    const custom = String(body.custom || '');
    const userMatch  = custom.match(/user:([^|]+)/);
    const coinsMatch = custom.match(/coins:(\d+)/);
    if (!userMatch || !coinsMatch) {
      audit('paypal:badCustom', { custom, txn_id: body.txn_id || null });
      return;
    }
    const username = userMatch[1].trim();
    const coins    = parseInt(coinsMatch[1], 10);

    if (!isValidName(username) || !COIN_PACKS[coins]) {
      audit('paypal:badPack', { username, coins, txn_id: body.txn_id || null });
      return;
    }

    // Confirm what was actually paid matches what this coin pack costs,
    // so a tampered custom field can't claim more coins than paid for.
    const expectedUsd = COIN_PACKS[coins];
    const paidUsd = parseFloat(body.mc_gross);
    const paidCurrency = body.mc_currency;
    if (paidCurrency !== 'USD' || isNaN(paidUsd) || Math.abs(paidUsd - expectedUsd) > 0.01) {
      audit('paypal:amountMismatch', { username, coins, expectedUsd, paidUsd, paidCurrency, txn_id: body.txn_id || null });
      return;
    }

    const txnId = body.txn_id || null;
    const credited = await creditWallet(username, coins, txnId, {
      method: 'paypal', amount: paidUsd, currency: paidCurrency,
    });
    audit(credited ? 'paypal:credited' : 'paypal:duplicate', { username, coins, txn_id: txnId });
  } catch (e) {
    console.error('[paypal-ipn] verification failed:', e.message);
    audit('paypal:error', { error: e.message });
  }
});

// ─── MetaMask / ETH verification ─────────────────────────────────────────────
// Must mirror shop.js's CONFIG.metamaskAddress + ethPrices exactly. Previously
// the client called grantCoins() the moment window.ethereum reported success —
// which means anyone could open devtools and call that function directly, or
// a modified page could fake success, and get free coins with no real payment.
// This endpoint makes the SERVER the one who decides whether the ETH actually
// arrived, by reading the transaction straight off a public Ethereum node.
const METAMASK_ADDRESS = '0x6D08AcBc3910c8eC7A45D8Df8796aEEcfe7A70Bb';
const ETH_PACKS = { // coins -> expected wei (must match shop.js ethPrices)
  50:    '250000000000000',
  200:   '1000000000000000',
  600:   '2500000000000000',
  1500:  '5000000000000000',
  4000:  '10000000000000000',
  10000: '25000000000000000',
  25000: '60000000000000000',
};
const ETH_RPC_URL = process.env.ETH_RPC_URL || 'https://cloudflare-eth.com';

async function ethRpc(method, params) {
  const res = await fetch(ETH_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  return data.result;
}

app.post('/api/metamask/verify', async (req, res) => {
  try {
    const { username, txHash, coins } = req.body || {};
    if (!isValidName(username)) return res.status(400).json({ error: 'Invalid username.' });
    if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({ error: 'Invalid transaction hash.' });
    }
    const coinAmount = parseInt(coins, 10);
    if (!ETH_PACKS[coinAmount]) return res.status(400).json({ error: 'Unknown coin pack.' });

    const tx = await ethRpc('eth_getTransactionByHash', [txHash]);
    if (!tx) return res.json({ success: false, reason: 'pending', message: 'Transaction not found yet — try again shortly.' });
    if (!tx.blockNumber) return res.json({ success: false, reason: 'pending', message: 'Waiting for confirmation…' });

    if ((tx.to || '').toLowerCase() !== METAMASK_ADDRESS.toLowerCase()) {
      audit('metamask:wrongRecipient', { username, txHash, to: tx.to });
      return res.status(400).json({ error: 'Transaction did not go to the correct address.' });
    }

    const expectedWei = BigInt(ETH_PACKS[coinAmount]);
    const paidWei = BigInt(tx.value || '0x0');
    if (paidWei < expectedWei) {
      audit('metamask:underpaid', { username, txHash, expectedWei: expectedWei.toString(), paidWei: paidWei.toString() });
      return res.status(400).json({ error: 'Transaction amount is less than required.' });
    }

    // Require at least 1 confirmation so a chain reorg can't undo the credit.
    const latestHex = await ethRpc('eth_blockNumber', []);
    const confirmations = parseInt(latestHex, 16) - parseInt(tx.blockNumber, 16);
    if (confirmations < 1) {
      return res.json({ success: false, reason: 'pending', message: 'Waiting for confirmation…' });
    }

    // creditWallet itself is the source of truth for "already paid" — it
    // checks the permanent payments/{txHash} record inside a transaction,
    // so this can be called repeatedly (the poll loop does exactly that)
    // without ever double-crediting.
    const credited = await creditWallet(username, coinAmount, txHash, {
      method: 'metamask', amount: (Number(paidWei) / 1e18).toFixed(6), currency: 'ETH',
    });
    if (!credited) {
      return res.json({ success: false, reason: 'already_credited' });
    }
    audit('metamask:credited', { username, coins: coinAmount, txHash });
    res.json({ success: true, coins: coinAmount });
  } catch (e) {
    console.error('[metamask-verify] failed:', e.message);
    res.status(500).json({ error: 'Verification failed, try again.' });
  }
});

// ─── Wallet balance — polled by shop.js after checkout ──────────────────────
app.get('/api/wallet/:username', async (req, res) => {
  const username = req.params.username;
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  const [coins, unlocks] = await Promise.all([getWalletBalance(username), getUnlocks(username)]);
  res.json({ coins, unlocks });
});

// ─── Shop purchase — the actual anti-cheat gate ─────────────────────────────
// shop.js calls this instead of just deducting user.coins locally. Whatever
// the client's localStorage says the balance is gets completely ignored —
// only the server wallet counts. Insufficient real balance = instant 402,
// no item, no deduction, regardless of what the browser console claims.
app.post('/api/wallet/spend', async (req, res) => {
  const { username, itemId } = req.body || {};
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  if (typeof itemId !== 'string' || !SHOP_ITEM_COSTS[itemId]) {
    return res.status(400).json({ error: 'Unknown item.' });
  }

  const result = await debitWalletForItem(username, itemId);

  if (!result.success) {
    audit('spend:rejected', { username: sanitizeText(username, 24), itemId, reason: result.reason, balance: result.balance });
    const status = result.reason === 'already_owned' ? 409 : 402;
    return res.status(status).json(result);
  }

  audit('spend:success', { username: sanitizeText(username, 24), itemId, cost: SHOP_ITEM_COSTS[itemId], newBalance: result.balance });
  res.json(result);
});

// ─── Single-player coin reporting (capped + rate-limited, not fully verified)
// See the big comment above SHOP_ITEM_COSTS for the trust model here: this
// is deliberately NOT a blind "credit whatever the client says" endpoint.
app.post('/api/coins/earn', async (req, res) => {
  const { username, amount, reason } = req.body || {};
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0 || amt > EARN_MAX_PER_CALL) {
    audit('earn:rejected', { username: sanitizeText(username, 24), amount, reason: 'out_of_bounds' });
    return res.status(400).json({ error: 'Invalid amount.' });
  }
  if (typeof reason !== 'string' || !/^(win|reward:|chest:)/.test(reason)) {
    return res.status(400).json({ error: 'Invalid reason.' });
  }
  if (!checkEarnRate(username)) {
    audit('earn:rateLimited', { username: sanitizeText(username, 24), amount, reason });
    return res.status(429).json({ error: 'Too many earn reports — slow down.' });
  }

  const credited = await creditWallet(username, amt, null, { method: 'gameplay', reason: sanitizeText(reason, 40) });
  const balance = await getWalletBalance(username);
  res.json({ success: !!credited, balance });
});

// ─── Daily streak check-in — account-wide, not per-device ───────────────────
// Called once per session by streak-system.js. This is the source of truth
// for "has today's reward already been claimed" and "what day of the 7-day
// cycle is it" — the client only decides WHAT reward that day maps to and
// applies it locally (coins/XP/chest), same as before. Keeping the actual
// counter here means logging in from a phone and then a laptop the same day
// can't double-claim, and a missed day resets the same way everywhere.
app.post('/api/streak/checkin', async (req, res) => {
  const username = (req.body && req.body.username) || '';
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  try {
    const result = await checkInStreak(username);
    res.json(result);
  } catch (e) {
    console.error('[streak] check-in error:', e.message);
    res.status(500).json({ error: 'Streak check-in failed.' });
  }
});

// ─── Daily streak claim — grants every unlocked-but-unclaimed day ───────────
// Separate from check-in on purpose: checking in just unlocks a day (keeps
// the streak alive), claiming is the player actually collecting the
// reward(s). If they checked in on several days without opening the reward
// screen, this claims all of them at once — nothing is lost for not
// claiming immediately, only for letting the streak itself lapse.
app.post('/api/streak/claim', async (req, res) => {
  const username = (req.body && req.body.username) || '';
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  try {
    const result = await claimStreak(username);
    res.json(result);
  } catch (e) {
    console.error('[streak] claim error:', e.message);
    res.status(500).json({ error: 'Streak claim failed.' });
  }
});

// ─── Daily streak unlock — pay coins to skip ahead instead of waiting ───────
// Coin cost is decided and spent client-side (StreakSystem.unlock in
// streak-system.js — 50/100/200 for 1/2/3 days); this endpoint just
// advances the account-wide streak count by that many days so the skip is
// visible on every device, same as a normal check-in would be.
app.post('/api/streak/unlock', async (req, res) => {
  const username = (req.body && req.body.username) || '';
  const days = parseInt(req.body && req.body.days, 10);
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  if (!Number.isInteger(days) || days < 1) {
    return res.status(400).json({ error: 'Invalid unlock amount.' });
  }
  try {
    const result = await unlockStreakDays(username, days);
    res.json(result);
  } catch (e) {
    console.error('[streak] unlock error:', e.message);
    res.status(500).json({ error: 'Streak unlock failed.' });
  }
});

// ─── Payment history — admin-protected, for support/dispute lookups ─────────
// e.g. "I paid but didn't get my coins" — check this before assuming the
// worst; it's the permanent record of every payment this player made.
app.get('/api/payments/:username', async (req, res) => {
  const secret = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const username = req.params.username;
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  const history = await getPaymentHistory(username);
  if (history === null) {
    return res.status(503).json({ error: 'Payment history requires Firestore (FIREBASE_SERVICE_ACCOUNT_KEY) to be configured.' });
  }
  res.json({ username, payments: history });
});

// ─── Root route ────────────────────────────────────────────────────────────────
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
      code: r.code, mode: r.mode, state: r.state, teamSize: r.teamSize,
      players: r.teams.A.size + r.teams.B.size,
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
