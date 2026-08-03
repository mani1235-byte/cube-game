// server.js — CUBE GAME Secure Server (Security Hardened)
// Fixes: CORS, rate limiting, socket validation, anti-cheat, server-auth scores
// ============================================================================
'use strict';

const express  = require('express');
const http     = require('http');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');

// Where the local-file fallbacks (used when FIREBASE_SERVICE_ACCOUNT_KEY isn't
// set) get written. Defaults to the app folder — which Render wipes on every
// redeploy, same as before. If you attach a Render persistent disk, set
// DATA_DIR to its mount path (e.g. /var/data) in the Render env vars and
// these files will survive redeploys too. Firestore is still the real fix —
// this is just a safety net for whichever local file is active at the time.
const DATA_DIR = process.env.DATA_DIR || __dirname;
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

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
      'https://mani1235-byte.github.io',
      'https://cube-game-515d7.web.app',
      'https://cube-game-515d7.firebaseapp.com', // Firebase Hosting's other default domain — same site, add for safety
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',   // VS Code "Live Server" default — local dev only
      'http://127.0.0.1:5500',
      'http://localhost:5501',   // Live Server sometimes falls back to this port if 5500 is busy
      'http://127.0.0.1:5501',
      'http://localhost:8080',   // npm "live-server" package default port
      'http://127.0.0.1:8080',
    ];

// Firebase client config — served to the browser via /config (never in static JS).
// This is ONLY for Google Sign-In (login.js/firebase-auth.js) — unrelated to
// data storage below, which now runs on Supabase instead of Firebase.
const FIREBASE_CLIENT_CONFIG = {
  apiKey:            process.env.FIREBASE_API_KEY        || null,
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN    || null,
  projectId:         process.env.FIREBASE_PROJECT_ID     || null,
  appId:             process.env.FIREBASE_APP_ID         || null,
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET || null,
  messagingSenderId: process.env.FIREBASE_SENDER_ID      || null,
};

// ─── Supabase — server-side data storage ──────────────────────────────────────
// Everything the server needs to remember permanently (wallet balances,
// payments, unlocked items, streaks, leaderboard) lives in Supabase Postgres
// tables now, reached over plain HTTPS via its REST API. If SUPABASE_URL /
// SUPABASE_SERVICE_KEY aren't set, everything below falls back to local JSON
// files (see DATA_DIR above) so the app still runs — but that data won't
// survive a Render redeploy unless DATA_DIR points at a persistent disk.
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || null;
const useSupabase = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
if (useSupabase) {
  console.log('🟢 Supabase connected — wallet, unlocks, streaks, and leaderboard will persist permanently.');
} else {
  console.warn('⚠️  SUPABASE_URL/SUPABASE_SERVICE_KEY not set — data will only persist to local files, which Render wipes on redeploy. Set these env vars for real persistence.');
}

async function supabaseFetch(pathAndQuery, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.status === 204 ? null : res.json();
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
    "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://pagead2.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://www.googletagmanager.com https://scripts.simpleanalyticscdn.com; " +
    "connect-src 'self' wss: ws: https://*.firebaseapp.com https://*.googleapis.com https://cubegame.club https://www.cubegame.club https://pagead2.googlesyndication.com https://adservice.google.com https://www.google-analytics.com https://www.googletagmanager.com https://scripts.simpleanalyticscdn.com https://queue.simpleanalyticscdn.com https://ep1.adtrafficquality.google https://www.gstatic.com; " +
    "img-src 'self' data: https://*.googleusercontent.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://www.google-analytics.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://pagead2.googlesyndication.com; " +
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
const SECRETS_FILE = path.join(DATA_DIR, 'secrets-found.json');
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

// ─── Audit log ────────────────────────────────────────────────────────────────
// (Also used by the REST API below — kept after multiplayer removal.)
const auditLog = [];
const MAX_AUDIT = 5000;

function audit(type, data) {
  const entry = { ts: new Date().toISOString(), type, ...data };
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT) auditLog.shift();
  if (type.startsWith('cheat') || type.startsWith('ban')) {
    console.warn('[AUDIT]', entry);
  }
}

// ─── Input validation helpers ──────────────────────────────────────────────────
// (Also used by the REST API below.)
function isValidName(name) {
  // \w is ASCII-only, so this used to reject any name with accented
  // letters or non-Latin characters (é, ñ, 中, etc.) — which is exactly
  // what Google Sign-In hands back as displayName for a lot of real
  // players. That made isValidName() (used by the leaderboard and every
  // other username-keyed endpoint) silently reject those submissions:
  // the client's fetch would come back !res.ok, submitScore() would
  // return null, and the run just never made it onto the board — no
  // error shown to the player, it just looked like the game "forgot" them.
  // \p{L}/\p{N} (with the /u flag) match letters/numbers in ANY script,
  // so Google / guest / registered names all validate the same way now.
  return typeof name === 'string' && name.trim().length >= 1 && name.length <= 24
    && /^[\p{L}\p{N}\s\-\.']+$/u.test(name);
}

function sanitizeText(str, maxLen = 200) {
  return String(str || '').slice(0, maxLen)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
const WALLET_FILE = path.join(DATA_DIR, 'wallet-ledger.json');
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
  if (useSupabase) {
    try {
      if (txnId) {
        const existing = await supabaseFetch(`payments?txn_id=eq.${encodeURIComponent(txnId)}&select=txn_id`);
        if (existing && existing.length) return false; // this exact payment was already recorded
      }
      const rows = await supabaseFetch(`wallets?username=eq.${encodeURIComponent(username)}&select=coins`);
      const currentCoins = (rows && rows[0] && rows[0].coins) || 0;
      await supabaseFetch('wallets', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ username, coins: currentCoins + coins, updated_at: new Date().toISOString() }),
      });
      await supabaseFetch('payments', {
        method: 'POST',
        body: JSON.stringify({
          txn_id: txnId || crypto.randomUUID(),
          username, coins,
          method:   meta.method   || 'unknown',
          amount:   meta.amount   ?? null,
          currency: meta.currency ?? null,
        }),
      });
      return true;
    } catch (e) {
      console.error('[wallet] Supabase credit failed, falling back to local file:', e.message);
      return creditWalletLocal(username, coins, txnId);
    }
  }
  return creditWalletLocal(username, coins, txnId);
}

async function getWalletBalance(username) {
  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`wallets?username=eq.${encodeURIComponent(username)}&select=coins`);
      return (rows && rows[0] && rows[0].coins) || 0;
    } catch (e) {
      console.error('[wallet] Supabase read failed, falling back to local file:', e.message);
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

const UNLOCKS_FILE = path.join(DATA_DIR, 'unlocks-ledger.json');
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
  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`unlocks?username=eq.${encodeURIComponent(username)}&select=items`);
      return (rows && rows[0] && rows[0].items) || [];
    } catch (e) {
      console.error('[unlocks] Supabase read failed, falling back to local file:', e.message);
    }
  }
  return unlocksLocal[username] || [];
}

// Verify the item exists + isn't already owned, check balance, deduct,
// record ownership. Returns { success, balance, reason? }.
// NOTE: this is a read-then-write over REST, same small race-condition
// window the local-file fallback below always had (two purchases landing
// in the same instant could both read the same starting balance) — not
// worth a Postgres stored procedure for this app's scale/risk, but worth
// knowing if that ever needs tightening up.
async function debitWalletForItem(username, itemId) {
  const cost = SHOP_ITEM_COSTS[itemId];
  if (!cost) return { success: false, reason: 'unknown_item' };

  if (useSupabase) {
    try {
      const [walletRows, unlockRows] = await Promise.all([
        supabaseFetch(`wallets?username=eq.${encodeURIComponent(username)}&select=coins`),
        supabaseFetch(`unlocks?username=eq.${encodeURIComponent(username)}&select=items`),
      ]);
      const balance = (walletRows && walletRows[0] && walletRows[0].coins) || 0;
      const owned   = (unlockRows && unlockRows[0] && unlockRows[0].items) || [];

      if (owned.includes(itemId)) return { success: false, reason: 'already_owned', balance };
      if (balance < cost) return { success: false, reason: 'insufficient_funds', balance };

      const newBalance = balance - cost;
      await Promise.all([
        supabaseFetch('wallets', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ username, coins: newBalance, updated_at: new Date().toISOString() }),
        }),
        supabaseFetch('unlocks', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ username, items: [...owned, itemId], updated_at: new Date().toISOString() }),
        }),
      ]);
      return { success: true, balance: newBalance, itemId };
    } catch (e) {
      console.error('[wallet] Supabase debit failed, falling back to local file:', e.message);
    }
  }

  // Local-file fallback (dev / no Supabase configured)
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

async function getPaymentHistory(username) {
  if (!useSupabase) return null; // history isn't available in local-file fallback mode
  const rows = await supabaseFetch(
    `payments?username=eq.${encodeURIComponent(username)}&select=*&order=credited_at.desc&limit=100`
  );
  return rows || [];
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
const STREAK_FILE = path.join(DATA_DIR, 'streak-ledger.json');
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

  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`streaks?username=eq.${encodeURIComponent(username)}&select=*`);
      const row = rows && rows[0];
      const prev = row ? { count: row.count, longest: row.longest, lastCheckIn: row.last_check_in, claimedUpTo: row.claimed_up_to } : {};
      const { streak, alreadyCheckedIn } = advanceStreak(prev, today);
      if (!alreadyCheckedIn) {
        await supabaseFetch('streaks', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            username, count: streak.count, longest: streak.longest,
            last_check_in: streak.lastCheckIn, claimed_up_to: streak.claimedUpTo,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      return finishStreakResult({ streak, alreadyCheckedIn });
    } catch (e) {
      console.error('[streak] Supabase check-in failed, falling back to local file:', e.message);
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
  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`streaks?username=eq.${encodeURIComponent(username)}&select=*`);
      const row = rows && rows[0];
      const prev = row ? { count: row.count, longest: row.longest, lastCheckIn: row.last_check_in, claimedUpTo: row.claimed_up_to } : {};
      const claim = buildClaim(prev);
      if (claim.claimed.length) {
        await supabaseFetch('streaks', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            username, count: prev.count || 0, longest: prev.longest || 0,
            last_check_in: prev.lastCheckIn || null, claimed_up_to: claim.claimedUpTo,
            updated_at: new Date().toISOString(),
          }),
        });
      }
      return claim;
    } catch (e) {
      console.error('[streak] Supabase claim failed, falling back to local file:', e.message);
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

  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`streaks?username=eq.${encodeURIComponent(username)}&select=*`);
      const row = rows && rows[0];
      const prev = row ? { count: row.count, longest: row.longest, claimedUpTo: row.claimed_up_to } : {};
      const next = {
        count: (prev.count || 0) + days,
        claimedUpTo: prev.claimedUpTo || 0,
        lastCheckIn: today,
      };
      next.longest = Math.max(prev.longest || 0, next.count);
      await supabaseFetch('streaks', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          username, count: next.count, longest: next.longest,
          last_check_in: next.lastCheckIn, claimed_up_to: next.claimedUpTo,
          updated_at: new Date().toISOString(),
        }),
      });
      return finishStreakResult({ streak: next, alreadyCheckedIn: false });
    } catch (e) {
      console.error('[streak] Supabase unlock failed, falling back to local file:', e.message);
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

// ─── Leaderboard (server-authoritative — keeps each player's best score) ───
// A submission only ever raises a player's stored best, never lowers it —
// so a stale or replayed call can't erase a real high score. Falls back to
// a local JSON file (DATA_DIR) if Supabase isn't configured.

const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard-local.json');
let leaderboardLocal = {}; // { username: { score, updatedAt } } — fallback only
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    leaderboardLocal = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
  }
} catch (e) {
  console.warn('[leaderboard] could not load leaderboard-local.json — starting fresh:', e.message);
  leaderboardLocal = {};
}
function saveLeaderboardLocal() {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboardLocal));
  } catch (e) {
    console.warn('[leaderboard] could not persist leaderboard-local.json:', e.message);
  }
}

// Anything above this is bogus — nowhere near reachable by legitimate play —
// so it's rejected outright rather than silently capped.
const LEADERBOARD_MAX_SCORE = 5000000;
const LEADERBOARD_MAX_CALLS_PER_WINDOW = 20;
const LEADERBOARD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const leaderboardRateBuckets = new Map(); // username → { count, resetAt }

function checkLeaderboardRate(username) {
  const now = Date.now();
  let bucket = leaderboardRateBuckets.get(username);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + LEADERBOARD_WINDOW_MS };
    leaderboardRateBuckets.set(username, bucket);
  }
  bucket.count++;
  return bucket.count <= LEADERBOARD_MAX_CALLS_PER_WINDOW;
}

async function submitLeaderboardScore(username, score) {
  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`leaderboard?username=eq.${encodeURIComponent(username)}&select=score`);
      const current = (rows && rows[0] && rows[0].score) || 0;
      if (score <= current) return { updated: false, best: current };
      await supabaseFetch('leaderboard', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ username, score, updated_at: new Date().toISOString() }),
      });
      return { updated: true, best: score };
    } catch (e) {
      console.error('[leaderboard] Supabase write failed, falling back:', e.message);
    }
  }
  const current = (leaderboardLocal[username] && leaderboardLocal[username].score) || 0;
  if (score <= current) return { updated: false, best: current };
  leaderboardLocal[username] = { score, updatedAt: Date.now() };
  saveLeaderboardLocal();
  return { updated: true, best: score };
}

async function getTopLeaderboard(limit) {
  if (useSupabase) {
    try {
      const rows = await supabaseFetch(`leaderboard?select=username,score&order=score.desc&limit=${limit}`);
      return (rows || []).map((r) => ({ username: r.username, score: r.score || 0 }));
    } catch (e) {
      console.error('[leaderboard] Supabase read failed, falling back:', e.message);
    }
  }
  return Object.entries(leaderboardLocal)
    .map(([username, v]) => ({ username, score: v.score || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// How many players currently rank above a given score, i.e. what place that
// score would hold on the board right now.
async function getLeaderboardRank(score) {
  if (useSupabase) {
    try {
      const [above, total] = await Promise.all([
        supabaseFetch(`leaderboard?select=username&score=gt.${score}`, { headers: { Prefer: 'count=exact' } }),
        supabaseFetch(`leaderboard?select=username`, { headers: { Prefer: 'count=exact' } }),
      ]);
      return { rank: (above || []).length + 1, totalPlayers: (total || []).length };
    } catch (e) {
      console.error('[leaderboard] Supabase rank query failed, falling back:', e.message);
    }
  }
  const scores = Object.values(leaderboardLocal).map(v => v.score || 0);
  const above = scores.filter(s => s > score).length;
  return { rank: above + 1, totalPlayers: scores.length };
}

// Submit a run's score. Only updates the stored value if it beats the
// player's current best.
app.post('/api/leaderboard/submit', async (req, res) => {
  const { username, score } = req.body || {};
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  const s = Math.floor(Number(score));
  if (!Number.isFinite(s) || s < 0 || s > LEADERBOARD_MAX_SCORE) {
    audit('leaderboard:rejected', { username: sanitizeText(username, 24), score, reason: 'out_of_bounds' });
    return res.status(400).json({ error: 'Invalid score.' });
  }
  if (!checkLeaderboardRate(username)) {
    audit('leaderboard:rateLimited', { username: sanitizeText(username, 24), score: s });
    return res.status(429).json({ error: 'Too many submissions — slow down.' });
  }
  try {
    // Only ever raises the stored best (see submitLeaderboardScore) — a
    // lower score than what's already saved is accepted (so the endpoint
    // doesn't error out) but leaves the stored value untouched, and the
    // rank returned always reflects the player's true best, not this run.
    const result = await submitLeaderboardScore(username, s);
    const rankInfo = await getLeaderboardRank(result.best);
    res.json({ success: true, ...result, ...rankInfo });
  } catch (e) {
    console.error('[leaderboard] submit error:', e.message);
    res.status(500).json({ error: 'Leaderboard submit failed.' });
  }
});

// Standalone rank lookup — e.g. for re-checking a rank without submitting
// a new score, or for a UI that wants to show rank separately from submit.
app.get('/api/leaderboard/rank/:username', async (req, res) => {
  const username = req.params.username;
  if (!isValidName(username)) {
    return res.status(400).json({ error: 'Invalid username.' });
  }
  try {
    let best = 0;
    if (useSupabase) {
      const rows = await supabaseFetch(`leaderboard?username=eq.${encodeURIComponent(username)}&select=score`);
      best = (rows && rows[0] && rows[0].score) || 0;
    } else {
      best = (leaderboardLocal[username] && leaderboardLocal[username].score) || 0;
    }
    const rankInfo = await getLeaderboardRank(best);
    res.json({ username, best, ...rankInfo });
  } catch (e) {
    console.error('[leaderboard] rank lookup error:', e.message);
    res.status(500).json({ error: 'Leaderboard rank lookup failed.' });
  }
});

// Public top-N read — no auth required, this is meant to be shown to
// everyone (guests included), same as any in-game leaderboard screen.
app.get('/api/leaderboard', async (req, res) => {
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) limit = 50;
  limit = Math.min(limit, 100);
  try {
    const top = await getTopLeaderboard(limit);
    res.json({ leaderboard: top });
  } catch (e) {
    console.error('[leaderboard] read error:', e.message);
    res.status(500).json({ error: 'Leaderboard read failed.' });
  }
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
    return res.status(503).json({ error: 'Payment history requires Supabase (SUPABASE_URL/SUPABASE_SERVICE_KEY) to be configured.' });
  }
  res.json({ username, payments: history });
});

// ─── Root route ────────────────────────────────────────────────────────────────
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'intro.html')));

// ─── Health / stats ───────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  uptime: process.uptime(),
}));

app.get('/stats', (req, res) => {
  // Only allow from localhost or with admin secret
  const secret = req.headers['x-admin-secret'];
  if (ADMIN_SECRET && secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({
    uptime: process.uptime(),
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

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🎮 Cube Game Server → http://localhost:${PORT}`);
  console.log(`🔒 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  if (!ADMIN_SECRET) console.warn('⚠️  ADMIN_SECRET not set — /stats and /audit are unprotected!');
});

// ─── Unhandled error guards ───────────────────────────────────────────────────
process.on('uncaughtException',  err => console.error('[CRASH]', err));
process.on('unhandledRejection', err => console.error('[REJECT]', err));
