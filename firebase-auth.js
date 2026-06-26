// firebase-auth.js — CUBE GAME Social Login
// API keys loaded from window.__FIREBASE_CONFIG__ injected by server
// NEVER hardcode API keys in client code

(function () {
  function init() {
    if (typeof firebase === "undefined") return setTimeout(init, 50);

    // Config is injected by the server at runtime (see server.js /config endpoint)
    // Falls back to meta tag if available
    let firebaseConfig = window.__FIREBASE_CONFIG__;

    if (!firebaseConfig) {
      // Try meta tag approach (set in HTML by server-side rendering)
      const meta = document.querySelector('meta[name="firebase-config"]');
      if (meta) {
        try { firebaseConfig = JSON.parse(atob(meta.content)); } catch(_) {}
      }
    }

    if (!firebaseConfig) {
      console.error('[firebase-auth] No Firebase config found. Set window.__FIREBASE_CONFIG__');
      return;
    }

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.addScope("profile");
    googleProvider.addScope("email");

    window.socialLogin = async function (providerName) {
      const provider = providerName === 'google' ? googleProvider : null;
      if (!provider) return;

      document.querySelectorAll(".btn--social").forEach(b => {
        b.disabled = true; b.style.opacity = "0.5";
      });

      try {
        const result   = await auth.signInWithPopup(provider);
        const user     = result.user;
        const idToken  = await user.getIdToken();

        // Send token to server for validation — server returns safe user data
        // Never store raw progression data from client
        const userData = {
          username:  user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
          email:     user.email,
          uid:       user.uid,
          photoURL:  user.photoURL,
          idToken,          // server validates this
          isGuest:   false,
          provider:  providerName,
          lastSeen:  Date.now(),
        };

        // Store only identity — NOT coins/trophies/rank (server owns those)
        localStorage.setItem("cg_current_user", JSON.stringify(userData));
        sessionStorage.setItem("cg_just_logged_in", "1");

        const card = document.getElementById("card");
        if (card) card.classList.add("success");

        setTimeout(function () {
          if (window.CinematicNav) CinematicNav.cinematic("./index.html");
          else window.location.href = "./index.html";
        }, 700);

      } catch (err) {
        const active = document.querySelector(".panel.active");
        const errEl  = active ? active.querySelector(".error-msg") : null;
        if (errEl) {
          const msgs = {
            "auth/popup-closed-by-user":  "Sign-in cancelled.",
            "auth/operation-not-allowed": "Enable this provider in Firebase Console.",
            "auth/popup-blocked":         "Popup blocked — please allow popups.",
          };
          errEl.textContent = msgs[err.code] || "Sign-in failed: " + (err.code || err.message);
          setTimeout(() => { errEl.textContent = ""; }, 5000);
        }
      } finally {
        document.querySelectorAll(".btn--social").forEach(b => {
          b.disabled = false; b.style.opacity = "";
        });
      }
    };

    auth.onAuthStateChanged(function (user) {
      if (user && !localStorage.getItem("cg_current_user")) {
        localStorage.setItem("cg_current_user", JSON.stringify({
          username: user.displayName || user.email?.split("@")[0] || "Player",
          email:    user.email,
          uid:      user.uid,
          photoURL: user.photoURL,
          isGuest:  false,
          lastSeen: Date.now(),
        }));
      }
    });
  }

  init();
})();
