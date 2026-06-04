// translate.js — Auto Google Translate using saved language choice
// Add <script src="./translate.js"></script> to ALL html pages
// ============================================================================

(function () {
  "use strict";

  const savedLang = localStorage.getItem("cg_lang") || "en";
  if (savedLang === "en") return; // English = default, no translation needed

  // ── Map our codes to Google Translate codes ───────────────────────────────
  const codeMap = {
    "zh":    "zh-CN",
    "zh-TW": "zh-TW",
    "pt-BR": "pt",
  };
  const gtCode = codeMap[savedLang] || savedLang;

  // ── Set Google Translate cookie ───────────────────────────────────────────
  function setGTCookie() {
    document.cookie = `googtrans=/en/${gtCode}; path=/`;
    document.cookie = `googtrans=/en/${gtCode}; path=/; domain=${location.hostname}`;
  }

  // ── Check if already translated (avoid infinite reload) ───────────────────
  const alreadyTranslated = document.cookie.includes(`googtrans=/en/${gtCode}`);

  if (!alreadyTranslated) {
    setGTCookie();
    // Reload once so Google Translate picks up the cookie
    location.reload();
    return;
  }

  // ── Hide Google Translate toolbar ─────────────────────────────────────────
  const hideStyle = document.createElement("style");
  hideStyle.textContent = `
    .goog-te-banner-frame { display: none !important; }
    .goog-te-gadget       { display: none !important; }
    #goog-gt-tt           { display: none !important; }
    .goog-tooltip         { display: none !important; }
    .goog-text-highlight  { background: none !important; box-shadow: none !important; }
    body                  { top: 0 !important; }
  `;
  document.head.appendChild(hideStyle);

  // ── Hidden GT element ──────────────────────────────────────────────────────
  const el = document.createElement("div");
  el.id = "google_translate_element";
  el.style.display = "none";
  document.body.appendChild(el);

  // ── Init callback ──────────────────────────────────────────────────────────
  window.googleTranslateElementInit = function () {
    new google.translate.TranslateElement(
      { pageLanguage: "en", autoDisplay: false },
      "google_translate_element"
    );
    // Force the language select to the right value
    setTimeout(() => {
      const select = document.querySelector(".goog-te-combo");
      if (select) {
        select.value = gtCode;
        select.dispatchEvent(new Event("change"));
      }
    }, 500);
  };

  // ── Load Google Translate ──────────────────────────────────────────────────
  const script = document.createElement("script");
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.head.appendChild(script);

})();