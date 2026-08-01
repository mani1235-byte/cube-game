// login.js — CUBE GAME Login System
// Accounts: email + password → stored locally by email key
// Username is a display name (shown in game/leaderboard), not the login key
// ============================================================================

const KEYS = {
  currentUser: "cg_current_user",
  users:       "cg_users",
  guestData:   "cg_guest",
};

function defaultSave(username, email) {
  return {
    username,
    email:         email || null,
    isGuest:       false,
    coins:         0,
    highScore:     0,
    totalGames:    0,
    unlockedItems: [],
    settings: { soundOn:true, musicOn:true, showFPS:false, colorTheme:"default" },
    createdAt: Date.now(),
    lastSeen:  Date.now(),
  };
}

// ── Storage helpers ───────────────────────────────────────────────────────
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(KEYS.users) || "{}"); } catch { return {}; }
}
function saveUsers(u) { localStorage.setItem(KEYS.users, JSON.stringify(u)); }
function setCurrentUser(data) { localStorage.setItem(KEYS.currentUser, JSON.stringify(data)); }
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(KEYS.currentUser)); } catch { return null; }
}

// ── Panel switcher ─────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".card-tab").forEach(t => t.classList.remove("active"));
  const panelEl = document.getElementById("panel" + name.charAt(0).toUpperCase() + name.slice(1));
  const tabEl   = document.getElementById("tab"   + name.charAt(0).toUpperCase() + name.slice(1));
  if (panelEl) panelEl.classList.add("active");
  if (tabEl)   tabEl.classList.add("active");
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll(".error-msg").forEach(e => e.textContent = "");
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ── Validate email format ─────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Show/hide password ────────────────────────────────────────────────────
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  btn.textContent = input.type === "password" ? "SHOW" : "HIDE";
}

// ── Guest play ────────────────────────────────────────────────────────────
function playAsGuest() {
  const nameInput = document.getElementById("guestName");
  const name = nameInput ? nameInput.value.trim() : "";
  if (!name) return showError("guestError", "Please enter a nickname.");
  if (name.length < 2) return showError("guestError", "Nickname must be at least 2 characters.");

  let guestData;
  try { guestData = JSON.parse(localStorage.getItem(KEYS.guestData)); } catch { guestData = null; }
  if (!guestData) {
    guestData = defaultSave(name, null);
    guestData.isGuest = true;
  } else {
    guestData.username = name;
    guestData.lastSeen = Date.now();
  }
  localStorage.setItem(KEYS.guestData, JSON.stringify(guestData));
  setCurrentUser(guestData);
  goToGame();
}

// ── Sign up (email + username + password) ─────────────────────────────────
function doSignup() {
  const username = (document.getElementById("signupUser")?.value  || "").trim();
  const email    = (document.getElementById("signupEmail")?.value || "").trim().toLowerCase();
  const pass     = document.getElementById("signupPass")?.value   || "";
  const pass2    = document.getElementById("signupPass2")?.value  || "";

  if (!username)           return showError("signupError", "Please choose a display name.");
  if (username.length < 2) return showError("signupError", "Display name must be at least 2 characters.");
  if (!email)              return showError("signupError", "Please enter your email.");
  if (!isValidEmail(email))return showError("signupError", "Please enter a valid email address.");
  if (!pass)               return showError("signupError", "Please choose a password.");
  if (pass.length < 6)     return showError("signupError", "Password must be at least 6 characters.");
  if (pass !== pass2)      return showError("signupError", "Passwords don't match.");

  const users = loadUsers();

  // Check email not already registered
  if (users[email]) return showError("signupError", "An account with that email already exists.");

  // Check display name not already taken
  const nameTaken = Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase());
  if (nameTaken) return showError("signupError", "That display name is already taken.");

  const newUser = defaultSave(username, email);
  newUser.passHash = simpleHash(pass);

  users[email] = newUser;
  saveUsers(users);
  setCurrentUser(newUser);

  flashSuccess();
  setTimeout(goToGame, 600);
}

// ── Login (email + password) ──────────────────────────────────────────────
function doLogin() {
  const email = (document.getElementById("loginEmail")?.value || "").trim().toLowerCase();
  const pass  = document.getElementById("loginPass")?.value  || "";

  if (!email)               return showError("loginError", "Please enter your email.");
  if (!isValidEmail(email)) return showError("loginError", "Please enter a valid email address.");
  if (!pass)                return showError("loginError", "Please enter your password.");

  const users = loadUsers();
  const user  = users[email];

  if (!user) return showError("loginError", "No account found with that email.");
  if (user.passHash !== simpleHash(pass)) return showError("loginError", "Wrong password.");

  user.lastSeen = Date.now();
  users[email]  = user;
  saveUsers(users);
  setCurrentUser(user);

  flashSuccess();
  setTimeout(goToGame, 600);
}

// ── Simple hash (client-side only — not cryptographically secure) ─────────
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16);
}

// ── Redirect to game ──────────────────────────────────────────────────────
// Instead of jumping straight into the game, ask the player once whether
// they want to play in the browser or grab the app — see the
// #platformOverlay modal in login.html.
function goToGame() {
  const overlay = document.getElementById("platformOverlay");
  if (overlay) {
    overlay.classList.add("open");
  } else {
    enterGame(); // modal not present for some reason — don't block play
  }
}

function enterGame() {
  sessionStorage.setItem("cg_just_logged_in", "1");
  if (window.CinematicNav) {
    setTimeout(() => CinematicNav.cinematic("./index.html"), 80);
  } else {
    setTimeout(() => { window.location.href = "./index.html"; }, 100);
  }
}

(function initPlatformModal() {
  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }
  ready(function () {
    const playWebBtn = document.getElementById("btnPlayWeb");
    const playAppBtn = document.getElementById("btnPlayApp");
    if (playWebBtn) playWebBtn.addEventListener("click", enterGame);
    if (playAppBtn) {
      playAppBtn.addEventListener("click", () => {
        window.location.href = "./downloads.html";
      });
    }
  });
})();

// ── Card success flash ────────────────────────────────────────────────────
function flashSuccess() {
  const card = document.getElementById("card");
  if (card) { card.classList.add("success"); setTimeout(() => card.classList.remove("success"), 400); }
}

// ── Floating background cubes ─────────────────────────────────────────────
function spawnBgCubes() {
  const container = document.getElementById("bgCubes");
  if (!container) return;
  const colors = ["#67d7f0","#a6e02c","#fa2473","#fe9522","#cc00ff"];
  for (let i = 0; i < 18; i++) {
    const cube  = document.createElement("div");
    cube.className = "bg-cube";
    const size  = 20 + Math.random() * 50;
    cube.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      border-color:${colors[Math.floor(Math.random()*colors.length)]}22;
      animation-duration:${8 + Math.random()*14}s;
      animation-delay:${Math.random()*12}s;
    `;
    container.appendChild(cube);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────
spawnBgCubes();

// Only auto-redirect if user is already fully signed in AND this is a
// deliberate return visit — NOT on every page load. The flag is set by
// index.html's routing guard, NOT here, so we don't intercept users who
// were explicitly logged out or whose session expired.
// (Auto-redirect is handled by index.html's guard script now — login.html
//  is only reached when the user genuinely needs to log in.)

// Enter key support
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const active = document.querySelector(".panel.active");
  if (!active) return;
  if (active.id === "panelGuest")  playAsGuest();
  if (active.id === "panelLogin")  doLogin();
  if (active.id === "panelSignup") doSignup();
});
