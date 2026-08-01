// server-config.js — single source of truth for your Render backend URL.
// Your frontend is on Netlify (cubegame.club); your API server is a
// SEPARATE app on Render. Any script that calls /api/... (leaderboard.js,
// shop.js's wallet sync, progression/*.js) needs this to build an absolute
// URL — a relative fetch("/api/...") would hit Netlify itself and 404.
//
// Include this ONE tag on every page, before shop.js / leaderboard.js:
//   <script src="./server-config.js"></script>
//
// Update this single value whenever your Render URL changes.
window.CUBE_SERVER = 'https://cube-game-fnam.onrender.com';
