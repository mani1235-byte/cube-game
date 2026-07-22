// firebase-auth.js — CUBE GAME Social Login
// ============================================================================

(function () {
  // Firebase CLIENT config — these keys are intentionally public.
  // (Security comes from Firestore rules, not from hiding these.)
  // Override any of these via Render env vars → /config endpoint.
  const FALLBACK_CONFIG = {
    apiKey:            "AIzaSyC_gTL3m6Snz9bUcTIr1teBWQG9KsG-0ds",
    authDomain:        "cube-game-515d7.firebaseapp.com",
    projectId:         "cube-game-515d7",
    appId:             "1:232796990803:web:d66c07add2373217a545a6",
    storageBucket:     "cube-game-515d7.appspot.com",
    messagingSenderId: "232796990803",
  };

  function init() {
    if (typeof firebase === "undefined") return setTimeout(init, 50);

    // Try server /config first (Render env vars), fall back to the baked-in config above.
    const configUrl = (window.CUBE_SERVER ? window.CUBE_SERVER.replace(/\/$/, '') : '') + '/config';
    fetch(configUrl)
      .then(r => r.ok ? r.json() : {})
      .catch(() => ({}))
      .then(serverConfig => {
        const firebaseConfig = (serverConfig && serverConfig.apiKey)
          ? serverConfig
          : FALLBACK_CONFIG;

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
            const result  = await auth.signInWithPopup(provider);
            const user    = result.user;
            const idToken = await user.getIdToken();

            const userData = {
              username:  user.displayName || (user.email ? user.email.split("@")[0] : "Player"),
              email:     user.email,
              uid:       user.uid,
              photoURL:  user.photoURL,
              idToken,
              isGuest:   false,
              provider:  providerName,
              lastSeen:  Date.now(),
            };

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
                "auth/operation-not-allowed": "Enable Google provider in Firebase Console.",
                "auth/popup-blocked":         "Popup blocked — please allow popups for this site.",
              };
              errEl.textContent = msgs[err.code] || "Sign-in failed: " + (err.code || err.message);
              setTimeout(() => { errEl.textContent = ""; }, 5000);
            }
            console.error("[firebase-auth] socialLogin error:", err.code, err.message);
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

        console.log("[firebase-auth] ready ✓");
      });
  }

  init();
})();
