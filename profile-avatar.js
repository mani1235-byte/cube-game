// profile-avatar.js — corner profile circle
(function () {

  function init() {
    const wrap      = document.getElementById("profileWrap");
    const circle    = document.getElementById("avatarCircle");
    const circleLg  = document.getElementById("avatarCircleLg");
    const panel     = document.getElementById("profileDropdown");
    const nameEl    = document.getElementById("profileName");
    const emailEl   = document.getElementById("profileEmail");
    const coinsEl   = document.getElementById("paCoins");
    const gamesEl   = document.getElementById("paGames");
    const scoreEl   = document.getElementById("paScore");
    const uploadBtn = document.getElementById("paUploadBtn");
    const imgInput  = document.getElementById("paImgInput");
    const logoutBtn = document.getElementById("profileLogout");

    if (!wrap || !circle) return;

    // ── Load user ────────────────────────────────────────────────────────
    let user = null;
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}

    function initials(name) {
      if (!name) return "?";
      const p = name.trim().split(" ");
      return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
    }

    function applyPhoto(el, photoURL, name) {
      if (photoURL) {
        el.style.backgroundImage = `url('${photoURL}')`;
        el.style.backgroundSize  = "cover";
        el.textContent = "";
      } else {
        el.style.backgroundImage = "";
        el.textContent = initials(name);
      }
    }

    function refresh() {
      try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}
      const photo = user && user.photoURL;
      const name  = user ? (user.username || "Player") : "Guest";
      applyPhoto(circle,   photo, name);
      applyPhoto(circleLg, photo, name);
      if (nameEl)  nameEl.textContent  = name;
      if (emailEl) emailEl.textContent = user ? (user.email || (user.isGuest ? "Playing as guest" : "")) : "";
      if (coinsEl) coinsEl.textContent = user ? (user.coins      || 0) : 0;
      if (gamesEl) gamesEl.textContent = user ? (user.totalGames || 0) : 0;
      if (scoreEl) scoreEl.textContent = user ? (user.highScore  || 0) : 0;
    }

    refresh();

    // ── Toggle panel ─────────────────────────────────────────────────────
    circle.addEventListener("click", function (e) {
      e.stopPropagation();
      refresh(); // always fresh stats
      panel.classList.toggle("open");
    });

    document.addEventListener("click", function (e) {
      if (wrap && !wrap.contains(e.target)) panel.classList.remove("open");
    });

    // ── View Profile button ───────────────────────────────────────────────
    const viewProfileBtn = document.createElement("button");
    viewProfileBtn.className = "pa-btn pa-btn-img";
    viewProfileBtn.style.marginBottom = "8px";
    viewProfileBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> View Profile';
    viewProfileBtn.addEventListener("click", function () {
      if (window.CinematicNav) { CinematicNav.cinematic("./profile.html"); }
      else { window.location.href = "./profile.html"; }
    });
    const logoutBtnEl = document.getElementById("profileLogout");
    if (logoutBtnEl) panel.insertBefore(viewProfileBtn, logoutBtnEl);
    else panel.appendChild(viewProfileBtn);

    // ── Upload photo ──────────────────────────────────────────────────────
    if (uploadBtn && imgInput) {
      uploadBtn.addEventListener("click", function () { imgInput.click(); });
      imgInput.addEventListener("change", function () {
        const file = imgInput.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          alert("Image too large — please use a photo under 2MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          const dataUrl = e.target.result;
          if (!user) user = {};
          user.photoURL = dataUrl;
          localStorage.setItem("cg_current_user", JSON.stringify(user));
          refresh();
        };
        reader.readAsDataURL(file);
      });
    }

    // ── Hide wrap during gameplay ─────────────────────────────────────────
    // Watch for main menu visibility
    const mainMenu = document.querySelector(".menu--main");
    if (mainMenu && wrap) {
      const observer = new MutationObserver(function () {
        const visible = mainMenu.style.display !== "none" &&
                        !mainMenu.classList.contains("hidden") &&
                        (mainMenu.classList.contains("menu--active") ||
                         getComputedStyle(mainMenu).display !== "none");
        wrap.style.display = visible ? "" : "none";
      });
      observer.observe(mainMenu, { attributes: true, attributeFilter: ["style", "class"] });
      // Also poll every 500ms as fallback (some games toggle display via JS)
      setInterval(function () {
        const d = getComputedStyle(mainMenu).display;
        wrap.style.display = (d === "none" || d === "") ? "none" : "";
      }, 500);
    }

    // ── Logout ────────────────────────────────────────────────────────────
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
