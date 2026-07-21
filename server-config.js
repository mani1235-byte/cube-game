// server-config.js — single source of truth for your Railway backend URL.
// Your frontend is on Netlify (cubegame.club); your API/Socket.io server is a
// SEPARATE app on Railway. Any script that calls /api/... (leaderboard.js,
// shop.js's wallet sync, multiplayer.js) needs this to build an absolute URL —
// a relative fetch("/api/...") would hit Netlify itself and 404.
//
// Include this ONE tag on every page, before shop.js / leaderboard.js /
// multiplayer.js:
//   <script src="./server-config.js"></script>
//
// Update this single value whenever your Railway URL changes.
window.CUBE_SERVER = 'https://cube-game-production-26c5.up.railway.app';
