// lang.js — CUBE GAME Language Picker
// Flow: lang.html → intro.html → login.html → index.html
// Saves language choice to localStorage for use across all pages
// ============================================================================

(function () {
  "use strict";

  // ── Auto-skip: if language already chosen, go straight to intro ──────────
  if (localStorage.getItem("cg_lang")) {
    window.location.replace("./intro.html");
    // Stop the rest of lang.js from running while redirect happens
    throw new Error("lang-skip");
  }


  // ── All world languages ───────────────────────────────────────────────────
  // Format: { code, name (English), native (in own script), flag emoji }
  const LANGUAGES = [
    { code:"af",    name:"Afrikaans",           native:"Afrikaans",              flag:"🇿🇦" },
    { code:"sq",    name:"Albanian",             native:"Shqip",                  flag:"🇦🇱" },
    { code:"am",    name:"Amharic",              native:"አማርኛ",                  flag:"🇪🇹" },
    { code:"ar",    name:"Arabic",               native:"العربية",                flag:"🇸🇦" },
    { code:"hy",    name:"Armenian",             native:"Հայերեն",                flag:"🇦🇲" },
    { code:"az",    name:"Azerbaijani",          native:"Azərbaycan",             flag:"🇦🇿" },
    { code:"eu",    name:"Basque",               native:"Euskara",                flag:"🏴" },
    { code:"be",    name:"Belarusian",           native:"Беларуская",             flag:"🇧🇾" },
    { code:"bn",    name:"Bengali",              native:"বাংলা",                  flag:"🇧🇩" },
    { code:"bs",    name:"Bosnian",              native:"Bosanski",               flag:"🇧🇦" },
    { code:"bg",    name:"Bulgarian",            native:"Български",              flag:"🇧🇬" },
    { code:"ca",    name:"Catalan",              native:"Català",                 flag:"🏴" },
    { code:"ceb",   name:"Cebuano",              native:"Cebuano",                flag:"🇵🇭" },
    { code:"zh",    name:"Chinese (Simplified)", native:"中文 (简体)",             flag:"🇨🇳" },
    { code:"zh-TW", name:"Chinese (Traditional)",native:"中文 (繁體)",             flag:"🇹🇼" },
    { code:"co",    name:"Corsican",             native:"Corsu",                  flag:"🇫🇷" },
    { code:"hr",    name:"Croatian",             native:"Hrvatski",               flag:"🇭🇷" },
    { code:"cs",    name:"Czech",                native:"Čeština",                flag:"🇨🇿" },
    { code:"da",    name:"Danish",               native:"Dansk",                  flag:"🇩🇰" },
    { code:"nl",    name:"Dutch",                native:"Nederlands",             flag:"🇳🇱" },
    { code:"en",    name:"English",              native:"English",                flag:"🇬🇧" },
    { code:"eo",    name:"Esperanto",            native:"Esperanto",              flag:"🟩" },
    { code:"et",    name:"Estonian",             native:"Eesti",                  flag:"🇪🇪" },
    { code:"fi",    name:"Finnish",              native:"Suomi",                  flag:"🇫🇮" },
    { code:"fr",    name:"French",               native:"Français",               flag:"🇫🇷" },
    { code:"fy",    name:"Frisian",              native:"Frysk",                  flag:"🇳🇱" },
    { code:"gl",    name:"Galician",             native:"Galego",                 flag:"🇪🇸" },
    { code:"ka",    name:"Georgian",             native:"ქართული",               flag:"🇬🇪" },
    { code:"de",    name:"German",               native:"Deutsch",                flag:"🇩🇪" },
    { code:"el",    name:"Greek",                native:"Ελληνικά",               flag:"🇬🇷" },
    { code:"gu",    name:"Gujarati",             native:"ગુજરાતી",                flag:"🇮🇳" },
    { code:"ht",    name:"Haitian Creole",       native:"Kreyòl ayisyen",         flag:"🇭🇹" },
    { code:"ha",    name:"Hausa",                native:"Hausa",                  flag:"🇳🇬" },
    { code:"haw",   name:"Hawaiian",             native:"ʻŌlelo Hawaiʻi",         flag:"🇺🇸" },
    { code:"he",    name:"Hebrew",               native:"עברית",                  flag:"🇮🇱" },
    { code:"hi",    name:"Hindi",                native:"हिन्दी",                 flag:"🇮🇳" },
    { code:"hmn",   name:"Hmong",                native:"Hmoob",                  flag:"🇱🇦" },
    { code:"hu",    name:"Hungarian",            native:"Magyar",                 flag:"🇭🇺" },
    { code:"is",    name:"Icelandic",            native:"Íslenska",               flag:"🇮🇸" },
    { code:"ig",    name:"Igbo",                 native:"Igbo",                   flag:"🇳🇬" },
    { code:"id",    name:"Indonesian",           native:"Bahasa Indonesia",       flag:"🇮🇩" },
    { code:"ga",    name:"Irish",                native:"Gaeilge",                flag:"🇮🇪" },
    { code:"it",    name:"Italian",              native:"Italiano",               flag:"🇮🇹" },
    { code:"ja",    name:"Japanese",             native:"日本語",                  flag:"🇯🇵" },
    { code:"jv",    name:"Javanese",             native:"Basa Jawa",              flag:"🇮🇩" },
    { code:"kn",    name:"Kannada",              native:"ಕನ್ನಡ",                 flag:"🇮🇳" },
    { code:"kk",    name:"Kazakh",               native:"Қазақ",                  flag:"🇰🇿" },
    { code:"km",    name:"Khmer",                native:"ភាសាខ្មែរ",              flag:"🇰🇭" },
    { code:"rw",    name:"Kinyarwanda",          native:"Ikinyarwanda",           flag:"🇷🇼" },
    { code:"ko",    name:"Korean",               native:"한국어",                  flag:"🇰🇷" },
    { code:"ku",    name:"Kurdish",              native:"Kurdî",                  flag:"🏴" },
    { code:"ky",    name:"Kyrgyz",               native:"Кыргызча",               flag:"🇰🇬" },
    { code:"lo",    name:"Lao",                  native:"ລາວ",                    flag:"🇱🇦" },
    { code:"la",    name:"Latin",                native:"Latina",                 flag:"🏛️" },
    { code:"lv",    name:"Latvian",              native:"Latviešu",               flag:"🇱🇻" },
    { code:"lt",    name:"Lithuanian",           native:"Lietuvių",               flag:"🇱🇹" },
    { code:"lb",    name:"Luxembourgish",        native:"Lëtzebuergesch",         flag:"🇱🇺" },
    { code:"mk",    name:"Macedonian",           native:"Македонски",             flag:"🇲🇰" },
    { code:"mg",    name:"Malagasy",             native:"Malagasy",               flag:"🇲🇬" },
    { code:"ms",    name:"Malay",                native:"Bahasa Melayu",          flag:"🇲🇾" },
    { code:"ml",    name:"Malayalam",            native:"മലയാളം",                flag:"🇮🇳" },
    { code:"mt",    name:"Maltese",              native:"Malti",                  flag:"🇲🇹" },
    { code:"mi",    name:"Maori",                native:"Māori",                  flag:"🇳🇿" },
    { code:"mr",    name:"Marathi",              native:"मराठी",                  flag:"🇮🇳" },
    { code:"mn",    name:"Mongolian",            native:"Монгол",                 flag:"🇲🇳" },
    { code:"my",    name:"Myanmar (Burmese)",    native:"မြန်မာဘာသာ",            flag:"🇲🇲" },
    { code:"ne",    name:"Nepali",               native:"नेपाली",                 flag:"🇳🇵" },
    { code:"no",    name:"Norwegian",            native:"Norsk",                  flag:"🇳🇴" },
    { code:"ny",    name:"Nyanja (Chichewa)",    native:"Chichewa",               flag:"🇲🇼" },
    { code:"or",    name:"Odia (Oriya)",         native:"ଓଡ଼ିଆ",                 flag:"🇮🇳" },
    { code:"ps",    name:"Pashto",               native:"پښتو",                   flag:"🇦🇫" },
    { code:"fa",    name:"Persian",              native:"فارسی",                  flag:"🇮🇷" },
    { code:"pl",    name:"Polish",               native:"Polski",                 flag:"🇵🇱" },
    { code:"pt",    name:"Portuguese",           native:"Português",              flag:"🇵🇹" },
    { code:"pt-BR", name:"Portuguese (Brazil)",  native:"Português (Brasil)",     flag:"🇧🇷" },
    { code:"pa",    name:"Punjabi",              native:"ਪੰਜਾਬੀ",                flag:"🇮🇳" },
    { code:"ro",    name:"Romanian",             native:"Română",                 flag:"🇷🇴" },
    { code:"ru",    name:"Russian",              native:"Русский",                flag:"🇷🇺" },
    { code:"sm",    name:"Samoan",               native:"Samoan",                 flag:"🇼🇸" },
    { code:"gd",    name:"Scots Gaelic",         native:"Gàidhlig",               flag:"🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
    { code:"sr",    name:"Serbian",              native:"Српски",                 flag:"🇷🇸" },
    { code:"st",    name:"Sesotho",              native:"Sesotho",                flag:"🇱🇸" },
    { code:"sn",    name:"Shona",                native:"chiShona",               flag:"🇿🇼" },
    { code:"sd",    name:"Sindhi",               native:"سنڌي",                   flag:"🇵🇰" },
    { code:"si",    name:"Sinhala",              native:"සිංහල",                  flag:"🇱🇰" },
    { code:"sk",    name:"Slovak",               native:"Slovenčina",             flag:"🇸🇰" },
    { code:"sl",    name:"Slovenian",            native:"Slovenščina",            flag:"🇸🇮" },
    { code:"so",    name:"Somali",               native:"Soomaali",               flag:"🇸🇴" },
    { code:"es",    name:"Spanish",              native:"Español",                flag:"🇪🇸" },
    { code:"su",    name:"Sundanese",            native:"Basa Sunda",             flag:"🇮🇩" },
    { code:"sw",    name:"Swahili",              native:"Kiswahili",              flag:"🇹🇿" },
    { code:"sv",    name:"Swedish",              native:"Svenska",                flag:"🇸🇪" },
    { code:"tl",    name:"Tagalog (Filipino)",   native:"Tagalog",                flag:"🇵🇭" },
    { code:"tg",    name:"Tajik",                native:"Тоҷикӣ",                 flag:"🇹🇯" },
    { code:"ta",    name:"Tamil",                native:"தமிழ்",                  flag:"🇮🇳" },
    { code:"tt",    name:"Tatar",                native:"Татар",                  flag:"🇷🇺" },
    { code:"te",    name:"Telugu",               native:"తెలుగు",                 flag:"🇮🇳" },
    { code:"th",    name:"Thai",                 native:"ไทย",                    flag:"🇹🇭" },
    { code:"tr",    name:"Turkish",              native:"Türkçe",                 flag:"🇹🇷" },
    { code:"tk",    name:"Turkmen",              native:"Türkmen",                flag:"🇹🇲" },
    { code:"uk",    name:"Ukrainian",            native:"Українська",             flag:"🇺🇦" },
    { code:"ur",    name:"Urdu",                 native:"اردو",                   flag:"🇵🇰" },
    { code:"ug",    name:"Uyghur",               native:"ئۇيغۇرچە",               flag:"🇨🇳" },
    { code:"uz",    name:"Uzbek",                native:"O'zbek",                 flag:"🇺🇿" },
    { code:"vi",    name:"Vietnamese",           native:"Tiếng Việt",             flag:"🇻🇳" },
    { code:"cy",    name:"Welsh",                native:"Cymraeg",                flag:"🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
    { code:"xh",    name:"Xhosa",                native:"isiXhosa",               flag:"🇿🇦" },
    { code:"yi",    name:"Yiddish",              native:"ייִדיש",                  flag:"🇮🇱" },
    { code:"yo",    name:"Yoruba",               native:"Yorùbá",                 flag:"🇳🇬" },
    { code:"zu",    name:"Zulu",                 native:"isiZulu",                flag:"🇿🇦" },
  ];

  // ── State ─────────────────────────────────────────────────────────────────
  let selectedCode = null;

  // ── Render grid ───────────────────────────────────────────────────────────
  const grid        = document.getElementById("langGrid");
  const confirmBtn  = document.getElementById("confirmBtn");
  const confirmText = document.getElementById("confirmText");
  const searchInput = document.getElementById("langSearch");

  function renderGrid(filter = "") {
    const q = filter.toLowerCase().trim();
    let anyVisible = false;

    // Remove old no-results msg
    const old = grid.querySelector(".no-results");
    if (old) old.remove();

    LANGUAGES.forEach(lang => {
      let btn = document.getElementById("lang-" + lang.code);
      if (!btn) {
        btn = document.createElement("button");
        btn.className = "lang-btn";
        btn.id = "lang-" + lang.code;
        btn.innerHTML = `
          <span class="lang-flag">${lang.flag}</span>
          <span class="lang-info">
            <span class="lang-name">${lang.name}</span>
            <span class="lang-native">${lang.native}</span>
          </span>
        `;
        btn.addEventListener("click", () => selectLang(lang));
        grid.appendChild(btn);
      }

      const matches = !q ||
        lang.name.toLowerCase().includes(q) ||
        lang.native.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q);

      btn.classList.toggle("hidden", !matches);
      if (matches) anyVisible = true;
    });

    if (!anyVisible) {
      const msg = document.createElement("div");
      msg.className = "no-results";
      msg.textContent = `No language found for "${filter}"`;
      grid.appendChild(msg);
    }
  }

  function selectLang(lang) {
    // Deselect previous
    if (selectedCode) {
      const prev = document.getElementById("lang-" + selectedCode);
      if (prev) prev.classList.remove("selected");
    }

    selectedCode = lang.code;
    const btn = document.getElementById("lang-" + lang.code);
    if (btn) {
      btn.classList.add("selected");
      btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Enable confirm button
    confirmBtn.disabled = false;
    confirmText.textContent = `PLAY IN ${lang.name.toUpperCase()}`;
  }

  // ── Search ────────────────────────────────────────────────────────────────
  searchInput.addEventListener("input", () => {
    renderGrid(searchInput.value);
  });

  // ── Confirm ───────────────────────────────────────────────────────────────
  confirmBtn.addEventListener("click", () => {
    if (!selectedCode) return;

    // Save language choice
    localStorage.setItem("cg_lang", selectedCode);

    // Cinematic transition to intro
    if (window.CinematicNav) {
      CinematicNav.cinematic("./intro.html");
    } else {
      document.body.style.transition = "opacity 0.6s ease";
      document.body.style.opacity    = "0";
      setTimeout(() => {
        window.location.href = "./intro.html";
      }, 650);
    }
  });

  // ── Auto-detect & auto-confirm device language ────────────────────────────
  function autoDetect() {
    // Walk full browser language list (most preferred first)
    const langs = Array.from(navigator.languages || [navigator.language || "en"]);
    let match = null;
    for (const raw of langs) {
      const code = raw.toLowerCase();
      // Exact match first (e.g. zh-TW)
      match = LANGUAGES.find(l => l.code.toLowerCase() === code);
      if (!match) {
        // Base language match (e.g. "fr" for "fr-CA")
        const base = code.split("-")[0];
        match = LANGUAGES.find(l => l.code.toLowerCase() === base || l.code.toLowerCase().startsWith(base));
      }
      if (match) break;
    }
    if (!match) return;

    selectLang(match);
    setTimeout(() => {
      const btn = document.getElementById("lang-" + match.code);
      if (btn) btn.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);

    // If language is non-English, show countdown banner and auto-confirm in 3s
    if (match.code === "en") return;

    let remaining = 3;
    const banner = document.createElement("div");
    banner.id = "autoLangBanner";
    banner.style.cssText = `
      position:fixed; top:0; left:0; right:0;
      background:rgba(10,15,30,0.95); border-bottom:1px solid rgba(103,215,240,0.3);
      color:#67d7f0; font-family:monospace; font-size:0.78rem; font-weight:bold;
      padding:10px 16px; text-align:center; z-index:9999; letter-spacing:0.06em;
      display:flex; align-items:center; justify-content:center; gap:12px;
    `;

    const msg  = document.createElement("span");
    const stay = document.createElement("button");
    stay.textContent = "CHOOSE MANUALLY";
    stay.style.cssText = `
      background:transparent; border:1px solid rgba(103,215,240,0.4);
      color:#67d7f0; font-family:monospace; font-size:0.7rem;
      padding:4px 10px; border-radius:4px; cursor:pointer; letter-spacing:0.05em;
    `;

    function updateMsg() {
      msg.textContent = `🌍 Detected: ${match.flag} ${match.name} — auto-starting in ${remaining}s…`;
    }
    updateMsg();
    banner.appendChild(msg);
    banner.appendChild(stay);
    document.body.appendChild(banner);

    let cancelled = false;
    stay.addEventListener("click", () => {
      cancelled = true;
      clearInterval(tick);
      banner.remove();
    });

    const tick = setInterval(() => {
      remaining--;
      if (cancelled) { clearInterval(tick); return; }
      if (remaining <= 0) {
        clearInterval(tick);
        banner.remove();
        localStorage.setItem("cg_lang", match.code);
        if (window.CinematicNav) {
          CinematicNav.cinematic("./intro.html");
        } else {
          document.body.style.transition = "opacity 0.5s";
          document.body.style.opacity    = "0";
          setTimeout(() => { window.location.href = "./intro.html"; }, 550);
        }
        return;
      }
      updateMsg();
    }, 1000);
  }

  // ── Canvas floating particles ─────────────────────────────────────────────
  const canvas = document.getElementById("langCanvas");
  const ctx    = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  const particles = Array.from({ length: 50 }, () => ({
    x:    Math.random() * window.innerWidth,
    y:    Math.random() * window.innerHeight,
    vx:   (Math.random() - 0.5) * 0.4,
    vy:   (Math.random() - 0.5) * 0.4,
    r:    Math.random() * 1.5 + 0.3,
    a:    Math.random(),
  }));

  function drawParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(103,215,240,${0.08 + Math.abs(Math.sin(Date.now() * 0.001 + p.a)) * 0.1})`;
      ctx.fill();
    });
    requestAnimationFrame(drawParticles);
  }
  drawParticles();

  // ── Init ──────────────────────────────────────────────────────────────────
  // First-time visitor: auto-detect device language and skip the picker
  (function () {
    const deviceLangs = Array.from(navigator.languages || [navigator.language || "en"]);
    let match = null;
    for (const raw of deviceLangs) {
      const code = raw.toLowerCase();
      match = LANGUAGES.find(l => l.code.toLowerCase() === code);
      if (!match) {
        const base = code.split("-")[0];
        match = LANGUAGES.find(l => l.code.toLowerCase() === base || l.code.toLowerCase().startsWith(base));
      }
      if (match) break;
    }

    // Non-English device: save language and go straight to intro
    if (match && match.code !== "en") {
      localStorage.setItem("cg_lang", match.code);
      if (window.CinematicNav) {
        CinematicNav.cinematic("./intro.html");
      } else {
        window.location.replace("./intro.html");
      }
      return;
    }

    // English or unrecognised: show picker with English pre-selected
    const en = LANGUAGES.find(l => l.code === "en");
    if (en) selectLang(en);
    renderGrid();
  })();

  console.log(`🌍 ${LANGUAGES.length} languages loaded`);

})();
