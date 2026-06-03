// cookie.js — GDPR Cookie Consent
// Add <script src="./cookie.js"></script> to ALL html pages
// ============================================================================

(function () {
  "use strict";

  const COOKIE_KEY = "cg_cookie_consent";

  // Already accepted — do nothing
  if (localStorage.getItem(COOKIE_KEY)) return;

  // ── Inject styles ──────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #cookieBanner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      background: linear-gradient(135deg, #0f1c28, #1a2c3d);
      border-top: 1px solid rgba(103,215,240,0.25);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      font-family: 'Share Tech Mono', monospace, monospace;
      box-shadow: 0 -4px 30px rgba(0,0,0,0.4);
      animation: slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    #cookieBanner .cookie-text {
      font-size: 0.78rem;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.04em;
      line-height: 1.6;
      flex: 1;
      min-width: 200px;
    }
    #cookieBanner .cookie-text a {
      color: #67d7f0;
      text-decoration: none;
    }
    #cookieBanner .cookie-text a:hover {
      text-decoration: underline;
    }
    #cookieBanner .cookie-btns {
      display: flex;
      gap: 10px;
      flex-shrink: 0;
    }
    #cookieBanner .cookie-accept {
      padding: 9px 20px;
      background: linear-gradient(135deg, rgba(103,215,240,0.25), rgba(166,224,44,0.2));
      border: 1px solid rgba(103,215,240,0.5);
      border-radius: 8px;
      color: #fff;
      font-family: inherit;
      font-size: 0.78rem;
      font-weight: bold;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.2s;
    }
    #cookieBanner .cookie-accept:hover {
      background: linear-gradient(135deg, rgba(103,215,240,0.4), rgba(166,224,44,0.3));
      box-shadow: 0 4px 16px rgba(103,215,240,0.25);
      transform: translateY(-1px);
    }
    #cookieBanner .cookie-decline {
      padding: 9px 16px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      color: rgba(255,255,255,0.4);
      font-family: inherit;
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.2s;
    }
    #cookieBanner .cookie-decline:hover {
      border-color: rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.7);
    }
  `;
  document.head.appendChild(style);

  // ── Build banner ───────────────────────────────────────────────────────────
  const banner = document.createElement("div");
  banner.id = "cookieBanner";
  banner.innerHTML = `
    <div class="cookie-text">
      🍪 We use cookies to save your game progress, language preference, and login session.
      By playing you agree to our <a href="./privacy.html">Privacy Policy</a>.
    </div>
    <div class="cookie-btns">
      <button class="cookie-decline" id="cookieDecline">DECLINE</button>
      <button class="cookie-accept" id="cookieAccept">ACCEPT & PLAY</button>
    </div>
  `;
  document.body.appendChild(banner);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function dismiss(accepted) {
    localStorage.setItem(COOKIE_KEY, accepted ? "accepted" : "declined");
    banner.style.transition = "transform 0.3s ease, opacity 0.3s ease";
    banner.style.transform  = "translateY(100%)";
    banner.style.opacity    = "0";
    setTimeout(() => banner.remove(), 350);
  }

  document.getElementById("cookieAccept").addEventListener("click", () => dismiss(true));
  document.getElementById("cookieDecline").addEventListener("click", () => dismiss(false));

})();
