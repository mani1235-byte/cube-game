// login.js
// DEPENDS ON: nothing — standalone login system
// Saves everything to localStorage until real backend is live on firstgame.org
// ============================================================================

// ── Storage keys ───────────────────────────────────────────────────────────
const KEYS = {
  currentUser: "cg_current_user",
  users:       "cg_users",        // all registered accounts
  guestData:   "cg_guest",        // guest save data
};

// ── Default save structure ─────────────────────────────────────────────────
function defaultSave(username) {
  return {
    username,
    isGuest:       false,
    coins:         0,
    highScore:     0,
    totalGames:    0,
    unlockedItems: [],
    settings: {
      soundOn:    true,
      musicOn:    true,
      showFPS:    false,
      colorTheme: "default",
    },
    createdAt: Date.now(),
    lastSeen:  Date.now(),
  };
}

// ── Load / save helpers ────────────────────────────────────────────────────
function loadUsers() {
  try { return JSON.parse(localStorage.getItem(KEYS.users) || "{}"); }
  catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(KEYS.users, JSON.stringify(users));
}
function setCurrentUser(data) {
  localStorage.setItem(KEYS.currentUser, JSON.stringify(data));
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(KEYS.currentUser)); }
  catch { return null; }
}

// ── Panel switcher ─────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".card-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("panel" + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
  document.getElementById("tab"   + name.charAt(0).toUpperCase() + name.slice(1)).classList.add("active");
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll(".error-msg").forEach(e => e.textContent = "");
}

function showError(id, msg) {
  document.getElementById(id).textContent = msg;
}

// ── Show/hide password ─────────────────────────────────────────────────────
function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "HIDE";
  } else {
    input.type = "password";
    btn.textContent = "SHOW";
  }
}

// ── Guest play ─────────────────────────────────────────────────────────────
function playAsGuest() {
  const nameInput = document.getElementById("guestName");
  const name = nameInput.value.trim();
  if (!name) return showError("guestError", "Username required.");

  // Load existing guest data or create fresh
  let guestData;
  try { guestData = JSON.parse(localStorage.getItem(KEYS.guestData)); } catch { guestData = null; }
  if (!guestData) {
    guestData = defaultSave(name);
    guestData.isGuest = true;
  } else {
    guestData.username = name;
    guestData.lastSeen = Date.now();
  }

  localStorage.setItem(KEYS.guestData, JSON.stringify(guestData));
  setCurrentUser(guestData);
  goToGame();
}

// ── Signup ─────────────────────────────────────────────────────────────────
function doSignup() {
  const username = document.getElementById("signupUser").value.trim();
  const pass     = document.getElementById("signupPass").value;
  const pass2    = document.getElementById("signupPass2").value;

  if (!username)            return showError("signupError", "Please choose a username.");
  if (username.length < 3)  return showError("signupError", "Username must be at least 3 characters.");
  if (!pass)                return showError("signupError", "Please choose a password.");
  if (pass.length < 6)      return showError("signupError", "Password must be at least 6 characters.");
  if (pass !== pass2)       return showError("signupError", "Passwords don't match.");

  const users = loadUsers();
  if (users[username.toLowerCase()]) return showError("signupError", "Username already taken.");

  // Simple hash (NOT secure — fine for local, replace with bcrypt on backend)
  const hashed = simpleHash(pass);
  const newUser = defaultSave(username);
  newUser.passHash = hashed;

  users[username.toLowerCase()] = newUser;
  saveUsers(users);
  setCurrentUser(newUser);

  flashSuccess();
  setTimeout(goToGame, 600);
}

// ── Login ──────────────────────────────────────────────────────────────────
function doLogin() {
  const username = document.getElementById("loginUser").value.trim();
  const pass     = document.getElementById("loginPass").value;

  if (!username) return showError("loginError", "Please enter your username.");
  if (!pass)     return showError("loginError", "Please enter your password.");

  const users = loadUsers();
  const user  = users[username.toLowerCase()];

  if (!user)                          return showError("loginError", "Username not found.");
  if (user.passHash !== simpleHash(pass)) return showError("loginError", "Wrong password.");

  user.lastSeen = Date.now();
  users[username.toLowerCase()] = user;
  saveUsers(users);
  setCurrentUser(user);

  flashSuccess();
  setTimeout(goToGame, 600);
}

// ── Simple hash (local only — replace with bcrypt server-side) ─────────────
function simpleHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0; // keep unsigned
  }
  return hash.toString(16);
}

// ── Redirect to game ───────────────────────────────────────────────────────
function goToGame() {
  // Set flag so index.html knows we just logged in
  sessionStorage.setItem("cg_just_logged_in", "1");
  if (window.CinematicNav) {
    setTimeout(() => CinematicNav.cinematic("./index.html"), 80);
  } else {
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 100);
  }
}

// ── Card success flash ─────────────────────────────────────────────────────
function flashSuccess() {
  const card = document.getElementById("card");
  card.classList.add("success");
  setTimeout(() => card.classList.remove("success"), 400);
}

// ── Floating background cubes ──────────────────────────────────────────────
function spawnBgCubes() {
  const container = document.getElementById("bgCubes");
  const colors = ["#67d7f0", "#a6e02c", "#fa2473", "#fe9522", "#cc00ff"];

  for (let i = 0; i < 18; i++) {
    const cube = document.createElement("div");
    cube.className = "bg-cube";
    const size   = 20 + Math.random() * 50;
    const left   = Math.random() * 100;
    const delay  = Math.random() * 12;
    const dur    = 8 + Math.random() * 14;
    const color  = colors[Math.floor(Math.random() * colors.length)];
    cube.style.cssText = `
      width:${size}px; height:${size}px;
      left:${left}%;
      border-color:${color}22;
      animation-duration:${dur}s;
      animation-delay:${delay}s;
    `;
    container.appendChild(cube);
  }
}

// ── Auto-redirect if already logged in ────────────────────────────────────
function checkAlreadyLoggedIn() {
  const user = getCurrentUser();
  if (user) {
    // Already has a session — go straight to game
    goToGame();
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
spawnBgCubes();
// Uncomment the line below to auto-skip login if already logged in:
// checkAlreadyLoggedIn();

// Enter key support
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const active = document.querySelector(".panel.active");
  if (!active) return;
  if (active.id === "panelGuest")  playAsGuest();
  if (active.id === "panelLogin")  doLogin();
  if (active.id === "panelSignup") doSignup();
});
