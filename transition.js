// transition.js — CUBE GAME Cinematic Page Transitions
// Handles: Fade in/out, Blur, Black cinematic overlay, Smooth scene switching
// ============================================================================

(function () {
  "use strict";

  // ── Inject transition styles ──────────────────────────────────────────────
  const style = document.createElement("style");
  style.id = "cinematic-transition-styles";
  style.textContent = `
    /* ── Cinematic Overlay (black bars top + bottom) ── */
    .cin-overlay {
      position: fixed;
      inset: 0;
      z-index: 99999;
      pointer-events: none;
    }

    /* Black bar top */
    .cin-overlay::before,
    .cin-overlay::after {
      content: '';
      position: fixed;
      left: 0;
      right: 0;
      height: 0;
      background: #000;
      transition: height 0.55s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 99999;
    }
    .cin-overlay::before { top: 0; }
    .cin-overlay::after  { bottom: 0; }

    .cin-overlay.cin-bars--open::before,
    .cin-overlay.cin-bars--open::after {
      height: 60px;
    }

    /* Full black fade layer */
    .cin-blackout {
      position: fixed;
      inset: 0;
      background: #000;
      z-index: 99998;
      opacity: 0;
      transition: opacity 0.45s ease;
      pointer-events: none;
    }
    .cin-blackout.cin-blackout--visible {
      opacity: 1;
    }

    /* Blur + scale on body content */
    body.cin-leaving > *:not(.cin-overlay):not(.cin-blackout) {
      filter: blur(8px) brightness(0.4);
      transform: scale(0.97);
      transition: filter 0.4s ease, transform 0.4s ease;
    }

    /* Fade in on page load */
    body.cin-entering {
      animation: cinFadeIn 0.6s ease forwards;
    }
    @keyframes cinFadeIn {
      from { opacity: 0; filter: blur(6px); }
      to   { opacity: 1; filter: blur(0);   }
    }

    /* Flash burst between scenes */
    .cin-flash {
      position: fixed;
      inset: 0;
      background: #fff;
      z-index: 99997;
      opacity: 0;
      pointer-events: none;
      animation: cinFlash 0.35s ease forwards;
    }
    @keyframes cinFlash {
      0%   { opacity: 0.45; }
      100% { opacity: 0;    }
    }

    /* Scan lines overlay for extra cinematic feel */
    .cin-scanlines {
      position: fixed;
      inset: 0;
      z-index: 99996;
      pointer-events: none;
      opacity: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.12) 2px,
        rgba(0,0,0,0.12) 4px
      );
      transition: opacity 0.3s ease;
    }
    .cin-scanlines.cin-scanlines--visible {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // ── Create DOM elements ──────────────────────────────────────────────────
  const overlay    = document.createElement("div");
  overlay.className = "cin-overlay";

  const blackout   = document.createElement("div");
  blackout.className = "cin-blackout";

  const scanlines  = document.createElement("div");
  scanlines.className = "cin-scanlines";

  document.body.appendChild(overlay);
  document.body.appendChild(blackout);
  document.body.appendChild(scanlines);

  // ── Page load: fade in ────────────────────────────────────────────────────
  document.body.classList.add("cin-entering");
  setTimeout(() => document.body.classList.remove("cin-entering"), 700);

  // ── Core navigate function ───────────────────────────────────────────────
  /**
   * navigateTo(url, options)
   * options: { bars: bool, flash: bool, duration: ms }
   * Replaces window.location.href for cinematic effect.
   */
  function navigateTo(url, opts = {}) {
    const { bars = true, flash = false, duration = 700 } = opts;

    // Already transitioning? bail
    if (document.body.dataset.cinTransitioning === "1") return;
    document.body.dataset.cinTransitioning = "1";

    // Step 1: scanlines appear
    scanlines.classList.add("cin-scanlines--visible");

    // Step 2: cinematic bars slide in
    if (bars) {
      overlay.classList.add("cin-bars--open");
    }

    // Step 3: blur + scale body
    document.body.classList.add("cin-leaving");

    // Step 4: blackout fades in
    setTimeout(() => {
      blackout.classList.add("cin-blackout--visible");
    }, bars ? 180 : 50);

    // Optional flash
    if (flash) {
      const f = document.createElement("div");
      f.className = "cin-flash";
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 400);
    }

    // Step 5: navigate
    setTimeout(() => {
      window.location.href = url;
    }, duration);
  }

  // ── Intercept all internal navigation links ───────────────────────────────
  function shouldIntercept(href) {
    if (!href) return false;
    if (href.startsWith("http") && !href.includes(window.location.hostname)) return false;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (href.startsWith("#")) return false;
    return true;
  }

  document.addEventListener("click", function (e) {
    // Find closest <a> tag
    const link = e.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!shouldIntercept(href)) return;
    if (link.target === "_blank") return;

    e.preventDefault();
    navigateTo(href, { bars: true, duration: 650 });
  }, true);

  // ── Patch window.location.href setter ────────────────────────────────────
  // Store original
  const _origAssign = window.location.assign.bind(window.location);
  const _origReplace = window.location.replace.bind(window.location);

  // Override location navigation triggered by JS
  // We expose a global helper so other scripts can use it
  window.CinematicNav = {
    go: navigateTo,

    // Quick navigate, no bars, just fade
    fade: function (url) {
      navigateTo(url, { bars: false, flash: false, duration: 500 });
    },

    // Full cinematic: bars + flash
    cinematic: function (url) {
      navigateTo(url, { bars: true, flash: true, duration: 750 });
    },
  };

  console.log("🎬 CinematicNav loaded");

})();
