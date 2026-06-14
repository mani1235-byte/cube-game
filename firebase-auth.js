// firebase-auth.js — CUBE GAME Social Login (no-module compat version)
// Works with file:// AND hosted — uses Firebase compat CDN loaded in login.html

(function () {

  // Wait for Firebase to be ready
  function init() {
    if (typeof firebase === "undefined") {
      return setTimeout(init, 50);
    }

    // ── Init Firebase ───────────────────────────────────────────
    const firebaseConfig = {
      apiKey:            "AIzaSyC_gTL3m6Snz9bUcTIr1teBWQG9KsG-0ds",
      authDomain:        "cube-game-515d7.firebaseapp.com",
      projectId:         "cube-game-515d7",
      storageBucket:     "cube-game-515d7.firebasestorage.app",
      messagingSenderId: "232796990803",
      appId:             "1:232796990803:web:d66c07add2373217a545a6",
      measurementId:     "G-F09Z1V2L7J",
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();

    // ── Providers ────────────────────────────────────────────────
    const googleProvider    = new firebase.auth.GoogleAuthProvider();

    googleProvider.addScope("profile");
    googleProvider.addScope("email");

    const providerMap = {
      google:    googleProvider,
    };

    // ── socialLogin() ─────────────────────────────────────────────
    window.socialLogin = async function (providerName) {
      const provider = providerMap[providerName];
      if (!provider) return;

      // Loading state
      document.querySelectorAll(".btn--social").forEach(b => {
        b.disabled = true;
        b.style.opacity = "0.5";
      });

      try {
        const result = await auth.signInWithPopup(provider);
        const user   = result.user;

        // Preserve existing coins, items, scores — never reset them on re-login
        var existing = {};
        try { existing = JSON.parse(localStorage.getItem("cg_current_user")) || {}; } catch (_) {}

        const userData = {
          // Preserve progression — fall back to 0/[] only for brand new accounts
          coins:         existing.coins         || 0,
          highScore:     existing.highScore      || 0,
          totalGames:    existing.totalGames     || 0,
          unlockedItems: existing.unlockedItems  || [],
          settings:      existing.settings       || { soundOn: true, musicOn: true, showFPS: false, colorTheme: "default" },
          createdAt:     existing.createdAt      || Date.now(),
          // Always update identity fields from the auth provider
          username:      user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
          email:         user.email,
          uid:           user.uid,
          photoURL:      user.photoURL,
          isGuest:       false,
          provider:      providerName,
          lastSeen:      Date.now(),
        };

        localStorage.setItem("cg_current_user", JSON.stringify(userData));
        sessionStorage.setItem("cg_just_logged_in", "1");

        const card = document.getElementById("card");
        if (card) card.classList.add("success");

        setTimeout(function () {
          if (window.CinematicNav) {
            CinematicNav.cinematic("./index.html");
          } else {
            window.location.href = "./index.html";
          }
        }, 700);

      } catch (err) {
        const active = document.querySelector(".panel.active");
        const errEl  = active ? active.querySelector(".error-msg") : null;
        if (errEl) {
          if (err.code === "auth/popup-closed-by-user") {
            errEl.textContent = "Sign-in cancelled.";
          } else if (err.code === "auth/operation-not-allowed") {
            errEl.textContent = "Enable this provider in Firebase Console → Authentication.";
          } else if (err.code === "auth/popup-blocked") {
            errEl.textContent = "Popup blocked — please allow popups for this site.";
          } else {
            errEl.textContent = "Sign-in failed: " + (err.message || err.code);
          }
          setTimeout(function () { errEl.textContent = ""; }, 5000);
        }
      } finally {
        document.querySelectorAll(".btn--social").forEach(b => {
          b.disabled = false;
          b.style.opacity = "";
        });
      }
    };

    // ── Restore session if already signed in ─────────────────────
    auth.onAuthStateChanged(function (user) {
      if (user && !localStorage.getItem("cg_current_user")) {
        var userData = {
          username: user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
          email:    user.email,
          uid:      user.uid,
          photoURL: user.photoURL,
          isGuest:  false,
          lastSeen: Date.now(),
        };
        localStorage.setItem("cg_current_user", JSON.stringify(userData));
      }
    });
  }

  init();
})();
