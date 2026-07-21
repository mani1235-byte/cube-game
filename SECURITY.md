# CUBE GAME — Security Changelog

## Security Changes Applied

### 🔴 Critical — server.js

| # | Problem | Fix |
|---|---------|-----|
| 1 | `origin: '*'` — all domains were allowed | CORS restricted to `ALLOWED_ORIGINS` from env |
| 2 | Score was received from the client | `cubeSliced` event → server calculates score |
| 3 | No rate limiting at all | 25 events/sec per socket + 120 req/min HTTP |
| 4 | evoStage was received from the client | Server controls it via `getEvoStage(score)` |
| 5 | Position had no validation | `checkMovement()` → speed hack + teleport detection |
| 6 | Coin/trophy rewards came from the client | `gameReward` is now only emitted by the server |
| 7 | `/stats` had no auth | Now requires `X-Admin-Secret` header |
| 8 | No audit log existed | All important events are now logged |
| 9 | No security headers existed | CSP, X-Frame-Options, X-XSS-Protection added |
| 10 | No error/crash handling | `uncaughtException` + `unhandledRejection` handlers added |

### 🔴 Critical — firebase-auth.js

| # | Problem | Fix |
|---|---------|-----|
| 11 | Firebase API key was hardcoded in the code | Now loaded from `window.__FIREBASE_CONFIG__` or a meta tag |
| 12 | Coins/trophies were stored in localStorage | Only identity is stored client-side; progression is server-side |

### 🟡 Important — firestore.rules

| # | Problem | Fix |
|---|---------|-----|
| 13 | No Firestore rules existed | `firestore.rules` file added |
| 14 | A user could modify their own coins/trophies | `validUserUpdate()` locks these fields |
| 15 | The leaderboard was writable by clients | `allow write: if false` — Admin SDK only |

### 🟢 Environment

| # | Problem | Fix |
|---|---------|-----|
| 16 | No `.env.example` existed | File added |
| 17 | `node_modules` and secrets were tracked in git | `.gitignore` added |

---

## Setting Up on Railway

```bash
# Environment variables to set in Railway:
PORT=3000
ALLOWED_ORIGINS=https://cube-game-production-26c5.up.railway.app/
ADMIN_SECRET=a-strong-random-string
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
```

## Firebase Console

1. **Authentication → Settings**: enable Email Verification
2. **Firestore → Rules**: paste the contents of `firestore.rules`
3. **Project Settings**: restrict the API key to your main domain only

## Security Testing

```bash
# Check for vulnerable dependencies
npm audit

# Test rate limiting
for i in $(seq 1 30); do curl http://localhost:3000/health; done

# Test /stats without a secret (should return 403)
curl http://localhost:3000/stats
```
