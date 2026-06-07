// profile.js
(function () {

  // ── Animated BG canvas ────────────────────────────────────────────────────
  const canvas = document.getElementById("bg");
  const ctx    = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x:    Math.random() * W,
      y:    Math.random() * H,
      r:    Math.random() * 1.5 + 0.3,
      vy:   -(Math.random() * 0.4 + 0.1),
      alpha: Math.random() * 0.5 + 0.1,
    };
  }

  function initParticles() {
    particles = Array.from({ length: 80 }, makeParticle);
  }

  function drawBg() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(0,180,255,0.04)";
    ctx.lineWidth   = 1;
    const gs = 44;
    for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Radial glow
    const grd = ctx.createRadialGradient(W/2, H*0.35, 0, W/2, H*0.35, W*0.55);
    grd.addColorStop(0, "rgba(0,120,255,0.08)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // Particles
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(0,220,255,${p.alpha})`;
      ctx.fill();
      p.y += p.vy;
      if (p.y < -4) { Object.assign(p, makeParticle()); p.y = H + 4; }
    });

    requestAnimationFrame(drawBg);
  }

  resize();
  initParticles();
  drawBg();
  window.addEventListener("resize", () => { resize(); initParticles(); });

  // ── Load user ────────────────────────────────────────────────────────────
  let user = null;
  try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}

  const avatarEl   = document.getElementById("avatar");
  const nameEl     = document.getElementById("profileName");
  const emailEl    = document.getElementById("profileEmail");
  const badgeEl    = document.getElementById("providerBadge");
  const coinsEl    = document.getElementById("statCoins");
  const gamesEl    = document.getElementById("statGames");
  const scoreEl    = document.getElementById("statScore");
  const itemsEl    = document.getElementById("statItems");
  const nameInput  = document.getElementById("nameInput");
  const nameSaveBtn= document.getElementById("nameSaveBtn");
  const nameHint   = document.getElementById("nameHint");
  const photoInput = document.getElementById("photoInput");
  const changePhotoBtn = document.getElementById("changePhotoBtn");
  const logoutBtn  = document.getElementById("logoutBtn");

  function initials(name) {
    if (!name) return "?";
    const p = name.trim().split(" ");
    return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
  }

  function applyAvatar(el, user) {
    if (user && user.photoURL) {
      el.style.backgroundImage = `url('${user.photoURL}')`;
      el.style.backgroundSize  = "cover";
      el.textContent = "";
    } else {
      el.style.backgroundImage = "";
      el.textContent = initials(user ? user.username : null);
    }
  }

  function renderPage() {
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}

    applyAvatar(avatarEl, user);

    if (nameEl)  nameEl.textContent  = user ? (user.username || "Player") : "Guest";
    if (emailEl) emailEl.textContent = user ? (user.email    || "No email") : "Not logged in";

    if (badgeEl) {
      const prov = user && user.provider;
      badgeEl.textContent = prov
        ? { google: "🔵 Signed in with Google", microsoft: "🟦 Signed in with Microsoft", apple: "⚫ Signed in with Apple" }[prov] || ("Signed in via " + prov)
        : user && !user.isGuest ? "📧 Email account" : "👤 Guest";
    }

    if (coinsEl) coinsEl.textContent = user ? (user.coins      || 0) : 0;
    if (gamesEl) gamesEl.textContent = user ? (user.totalGames || 0) : 0;
    if (scoreEl) scoreEl.textContent = user ? (user.highScore  || 0) : 0;
    if (itemsEl) itemsEl.textContent = user ? ((user.unlockedItems || []).length) : 0;
  }

  renderPage();

  // ── Upload photo ──────────────────────────────────────────────────────────
  if (changePhotoBtn) changePhotoBtn.addEventListener("click", () => photoInput.click());

  if (photoInput) {
    photoInput.addEventListener("change", function () {
      const file = photoInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert("Image too large — max 2MB please.");
        return;
      }
      const reader = new FileReader();
      reader.onload = function (e) {
        if (!user) user = {};
        user.photoURL = e.target.result;
        localStorage.setItem("cg_current_user", JSON.stringify(user));
        applyAvatar(avatarEl, user);
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Name change ───────────────────────────────────────────────────────────
  function updateHint() {
    const val = (nameInput.value || "").trim();
    if (!val) { nameHint.textContent = ""; nameHint.className = "name-hint"; return; }
    if (val.length < 3) {
      nameHint.textContent = "Too short (min 3 chars) — free";
      nameHint.className = "name-hint hint-free";
    } else if (val.length <= 8) {
      nameHint.textContent = "Free ✓";
      nameHint.className = "name-hint hint-free";
    } else {
      nameHint.textContent = "Long name — costs 50 🪙";
      nameHint.className = "name-hint hint-cost";
    }
  }

  if (nameInput) nameInput.addEventListener("input", updateHint);

  if (nameSaveBtn) {
    nameSaveBtn.addEventListener("click", function () {
      const newName = (nameInput.value || "").trim();
      if (!newName || newName.length < 3) {
        nameHint.textContent = "Name must be at least 3 characters.";
        nameHint.className = "name-hint hint-error";
        return;
      }
      if (!user) {
        nameHint.textContent = "Not logged in.";
        nameHint.className = "name-hint hint-error";
        return;
      }

      const isLong = newName.length > 8;
      const cost   = isLong ? 50 : 0;
      const coins  = user.coins || 0;

      if (isLong && coins < cost) {
        nameHint.textContent = "Not enough coins! You need 50 🪙";
        nameHint.className = "name-hint hint-error";
        return;
      }

      user.username = newName;
      if (isLong) user.coins = coins - cost;
      localStorage.setItem("cg_current_user", JSON.stringify(user));

      // Sync users store
      try {
        const users = JSON.parse(localStorage.getItem("cg_users") || "{}");
        const oldKey = Object.keys(users).find(k => users[k].uid === user.uid || users[k].email === user.email);
        if (oldKey) {
          users[newName.toLowerCase()] = { ...users[oldKey], username: newName, coins: user.coins };
          if (oldKey !== newName.toLowerCase()) delete users[oldKey];
          localStorage.setItem("cg_users", JSON.stringify(users));
        }
      } catch (_) {}

      renderPage();
      nameInput.value = "";
      nameHint.textContent = isLong ? `Done! -50 🪙 (${user.coins} coins left)` : "Username updated! ✓";
      nameHint.className = "name-hint hint-free";
      setTimeout(() => { nameHint.textContent = ""; nameHint.className = "name-hint"; }, 3000);
    });
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("cg_current_user");
      sessionStorage.clear();
      if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
        try { firebase.auth().signOut(); } catch (_) {}
      }
      if (window.CinematicNav) {
        CinematicNav.cinematic("./login.html");
      } else {
        window.location.href = "./login.html";
      }
    });
  }

})();
