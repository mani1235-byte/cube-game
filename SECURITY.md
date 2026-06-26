# CUBE GAME — Security Changelog

## تغییرات امنیتی اعمال‌شده

### 🔴 بحرانی — server.js

| # | مشکل | راه‌حل |
|---|------|--------|
| 1 | `origin: '*'` — همه دامنه‌ها مجاز بودن | CORS محدود به `ALLOWED_ORIGINS` در env |
| 2 | Score از client دریافت می‌شد | `cubeSliced` event → server score calc |
| 3 | هیچ rate limiting نداشت | 25 event/sec per socket + 120 req/min HTTP |
| 4 | evoStage از client دریافت می‌شد | Server کنترل می‌کنه با `getEvoStage(score)` |
| 5 | position بدون validation | `checkMovement()` → speed hack + teleport detect |
| 6 | Coin/trophy reward از client | `gameReward` فقط server emit می‌کنه |
| 7 | `/stats` بدون auth | `X-Admin-Secret` header لازمه |
| 8 | هیچ audit log نداشت | تمام events مهم log می‌شن |
| 9 | هیچ security header نداشت | CSP, X-Frame-Options, X-XSS-Protection |
| 10 | Error/crash handling نداشت | `uncaughtException` + `unhandledRejection` |

### 🔴 بحرانی — firebase-auth.js

| # | مشکل | راه‌حل |
|---|------|--------|
| 11 | Firebase API key داخل کد بود | از `window.__FIREBASE_CONFIG__` یا meta tag |
| 12 | coins/trophies در localStorage ذخیره می‌شد | فقط identity ذخیره می‌شه، progression server-side |

### 🟡 مهم — firestore.rules

| # | مشکل | راه‌حل |
|---|------|--------|
| 13 | هیچ Firestore rule نداشت | فایل `firestore.rules` اضافه شد |
| 14 | کاربر می‌تونست coins/trophies خودش رو تغییر بده | `validUserUpdate()` این فیلدها رو lock می‌کنه |
| 15 | leaderboard قابل write بود | `allow write: if false` — فقط Admin SDK |

### 🟢 محیطی

| # | مشکل | راه‌حل |
|---|------|--------|
| 16 | هیچ `.env.example` نداشت | فایل اضافه شد |
| 17 | `node_modules` و secrets در git | `.gitignore` اضافه شد |

---

## راه‌اندازی در Railway

```bash
# متغیرهای محیطی که باید در Railway تنظیم کنی:
PORT=3000
ALLOWED_ORIGINS=https://cube-game-production-e946.up.railway.app/
ADMIN_SECRET=یک-رشته-تصادفی-قوی
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
```

## Firebase Console

1. **Authentication → Settings**: فعال‌کن Email Verification
2. **Firestore → Rules**: محتوای `firestore.rules` رو paste کن
3. **Project Settings**: API key رو فقط به domain اصلی محدود کن

## تست امنیت

```bash
# بررسی dependency های آسیب‌پذیر
npm audit

# تست rate limiting
for i in $(seq 1 30); do curl http://localhost:3000/health; done

# تست /stats بدون secret (باید 403 بگیری)
curl http://localhost:3000/stats
```
