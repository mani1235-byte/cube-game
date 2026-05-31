// sound.js — CUBE GAME Sound System
// Works on both sound.html (settings page) AND index.html (game)
// ============================================================================

(function () {
  "use strict";

  const SETTINGS_KEY = "cg_sound_settings";

  // ── Load / save settings ──────────────────────────────────────────────
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return s || { musicOn: true, sfxOn: true, musicVol: 0.4, sfxVol: 0.7 };
    } catch(e) {
      return { musicOn: true, sfxOn: true, musicVol: 0.4, sfxVol: 0.7 };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }

  let settings = loadSettings();

  // ── Audio Context ─────────────────────────────────────────────────────
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // ── MP3 file paths ────────────────────────────────────────────────────
  const AUDIO_FILES = {
    slice:    "./destroy cube.mp3",
    gameover: "./game over.mp3",
    win:      "./you win.mp3",
    // gameplay music — add filename here when ready:
    // gameplayMusic: "./your-gameplay-music.mp3",
  };

  // ── Audio element pool ────────────────────────────────────────────────
  // Using HTML Audio elements for MP3s (better format support than WebAudio)
  const audioCache = {};

  function getAudio(key) {
    if (!audioCache[key]) {
      const el = new Audio(AUDIO_FILES[key]);
      el.preload = "auto";
      audioCache[key] = el;
    }
    return audioCache[key];
  }

  function playMP3(key, volume, loop) {
    try {
      const src = AUDIO_FILES[key];
      if (!src) return;
      // For SFX: clone so it can overlap
      const el = loop ? getAudio(key) : new Audio(src);
      el.volume = Math.min(1, Math.max(0, volume));
      el.loop   = !!loop;
      el.play().catch(() => {}); // ignore autoplay block
      return el;
    } catch(e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SOUND EFFECTS — now using real MP3 files
  // ═══════════════════════════════════════════════════════════════════════

  function playSlice() {
    if (!settings.sfxOn) return;
    playMP3("slice", settings.sfxVol * 0.9);
  }

  function playGameOver() {
    if (!settings.sfxOn) return;
    playMP3("gameover", settings.sfxVol);
  }

  function playWin() {
    if (!settings.sfxOn) return;
    playMP3("win", settings.sfxVol);
  }

  // ── Keep generated SFX for bomb, heart, menu, slowmo ─────────────────
  function playBombHit() {
    if (!settings.sfxOn) return;
    const c = getCtx();
    const buf = c.createBuffer(1, c.sampleRate * 0.3, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    const src = c.createBufferSource();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 300;
    src.buffer = buf; src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    gain.gain.setValueAtTime(settings.sfxVol * 0.8, c.currentTime);
    src.start();
  }

  function playHeartGain() {
    if (!settings.sfxOn) return;
    const c = getCtx();
    [523, 659, 784].forEach((freq, i) => {
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.connect(gain); gain.connect(c.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      const t = c.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(settings.sfxVol * 0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
    });
  }

  function playMenuClick() {
    if (!settings.sfxOn) return;
    const c = getCtx();
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "sine"; osc.frequency.value = 800;
    gain.gain.setValueAtTime(settings.sfxVol * 0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
  }

  function playSlowMo() {
    if (!settings.sfxOn) return;
    const c = getCtx();
    const osc = c.createOscillator(); const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.5);
    gain.gain.setValueAtTime(settings.sfxVol * 0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.5);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  BACKGROUND MUSIC — MP3 based
  // ═══════════════════════════════════════════════════════════════════════

  let musicEl = null;
  let musicPlaying = false;

  function startMusic() {
    if (musicPlaying || !settings.musicOn) return;
    // Use gameplay music if available, otherwise fall back to intro track
    const key = AUDIO_FILES.gameplayMusic ? "gameplayMusic" : "music";
    if (!AUDIO_FILES[key]) return;
    musicEl = getAudio(key);
    musicEl.volume = settings.musicVol;
    musicEl.loop   = true;
    musicEl.play().catch(() => {});
    musicPlaying = true;
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
  }

  function setMusicVolume(v) {
    if (musicEl) musicEl.volume = Math.min(1, Math.max(0, v));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SETTINGS PAGE LOGIC (only runs on sound.html)
  // ═══════════════════════════════════════════════════════════════════════

  function initSettingsPage() {
    const musicToggle = document.getElementById("musicToggle");
    const sfxToggle   = document.getElementById("sfxToggle");
    const musicVolEl  = document.getElementById("musicVol");
    const sfxVolEl    = document.getElementById("sfxVol");
    const musicValEl  = document.getElementById("musicVolVal");
    const sfxValEl    = document.getElementById("sfxVolVal");
    const saveBtn     = document.getElementById("saveBtn");

    if (!musicToggle) return; // not on settings page

    // Set initial values
    musicToggle.checked  = settings.musicOn;
    sfxToggle.checked    = settings.sfxOn;
    musicVolEl.value     = settings.musicVol;
    sfxVolEl.value       = settings.sfxVol;
    musicValEl.textContent = Math.round(settings.musicVol * 100) + "%";
    sfxValEl.textContent   = Math.round(settings.sfxVol   * 100) + "%";

    musicToggle.addEventListener("change", () => {
      settings.musicOn = musicToggle.checked;
      if (settings.musicOn) startMusic(); else stopMusic();
    });
    sfxToggle.addEventListener("change", () => { settings.sfxOn = sfxToggle.checked; });

    musicVolEl.addEventListener("input", () => {
      settings.musicVol = parseFloat(musicVolEl.value);
      musicValEl.textContent = Math.round(settings.musicVol * 100) + "%";
      setMusicVolume(settings.musicVol);
    });
    sfxVolEl.addEventListener("input", () => {
      settings.sfxVol = parseFloat(sfxVolEl.value);
      sfxValEl.textContent = Math.round(settings.sfxVol * 100) + "%";
    });

    saveBtn.addEventListener("click", () => {
      saveSettings(settings);
      playMenuClick();
      const toast = document.getElementById("savedToast");
      if (toast) {
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2500);
      }
    });

    // Canvas particles
    const canvas = document.getElementById("soundCanvas");
    if (canvas) {
      const ctx2 = canvas.getContext("2d");
      function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
      resize(); window.addEventListener("resize", resize);
      const particles = Array.from({ length: 40 }, () => ({
        x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.3, a: Math.random(),
      }));
      function draw() {
        ctx2.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
          ctx2.beginPath(); ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx2.fillStyle = `rgba(103,215,240,${0.04 + Math.abs(Math.sin(Date.now() * 0.001 + p.a)) * 0.07})`;
          ctx2.fill();
        });
        requestAnimationFrame(draw);
      }
      draw();
    }

    // Unlock audio on first interaction
    document.addEventListener("pointerdown", () => getCtx(), { once: true });
  }

  // Toast HTML
  document.body.insertAdjacentHTML("beforeend", `<div id="savedToast">✅ Settings saved!</div>`);

  // ═══════════════════════════════════════════════════════════════════════
  //  GAME HOOKS (only runs on index.html)
  // ═══════════════════════════════════════════════════════════════════════

  function initGameHooks() {
    if (typeof endGame === "undefined") return; // not on game page

    // Unlock audio on first touch
    document.addEventListener("pointerdown", () => {
      getCtx();
    }, { once: true });

    // Hook setActiveMenu — start/stop music based on game state
    const _origSetActiveMenu = window.setActiveMenu;
    window.setActiveMenu = function(menu) {
      _origSetActiveMenu(menu);
      if (menu === null) {
        // null = in game (playing)
        if (settings.musicOn && !musicPlaying) startMusic();
      } else {
        // any menu = not playing
        stopMusic();
      }
    };

    // Game over — stop music, play sound
    const _origEndGame = endGame;
    window.endGame = function() {
      _origEndGame(...arguments);
      stopMusic();
      playGameOver();
    };

    // Score increase = cube sliced
    const _origTick = tick;
    let prevScore = 0;
    window.tick = function(w, h, st, ss, lag) {
      _origTick(w, h, st, ss, lag);
      if (state.game.score > prevScore && isInGame()) {
        playSlice();
        prevScore = state.game.score;
      }
    };

    // Button clicks
    document.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", playMenuClick);
    });
  }

  // ── Expose global SOUND object ─────────────────────────────────────────
  window.SOUND = {
    slice:       playSlice,
    bombHit:     playBombHit,
    heartGain:   playHeartGain,
    gameOver:    playGameOver,
    win:         playWin,
    menuClick:   playMenuClick,
    slowMo:      playSlowMo,
    startMusic,
    stopMusic,
    test: function(name) {
      getCtx();
      const map = {
        slice: playSlice, bomb: playBombHit, heart: playHeartGain,
        win: playWin, gameover: playGameOver, slowmo: playSlowMo,
      };
      if (map[name]) map[name]();
    }
  };

  // ── Init ───────────────────────────────────────────────────────────────
  initSettingsPage();
  initGameHooks();

  console.log("🔊 Sound system loaded!");
})();

// ── Quick sound toggles in menus ──────────────────────────────────────────
(function initQuickSoundBtns() {
  const SETTINGS_KEY = "cg_sound_settings";

  function getSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { musicOn: true, sfxOn: true, musicVol: 0.4, sfxVol: 0.7 }; }
    catch(e) { return { musicOn: true, sfxOn: true, musicVol: 0.4, sfxVol: 0.7 }; }
  }
  function saveQuick(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

  function updateBtns() {
    const s = getSettings();
    ["quickMusicBtn", "pauseMusicBtn"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.toggle("muted", !s.musicOn);
      btn.textContent = s.musicOn ? "🎵 MUSIC" : "🔇 MUSIC";
    });
    ["quickSfxBtn", "pauseSfxBtn"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.classList.toggle("muted", !s.sfxOn);
      btn.textContent = s.sfxOn ? "🔊 SFX" : "🔕 SFX";
    });
  }

  function toggleMusic() {
    const s = getSettings();
    s.musicOn = !s.musicOn;
    saveQuick(s);
    if (window.SOUND) { if (s.musicOn) window.SOUND.startMusic(); else window.SOUND.stopMusic(); }
    updateBtns();
  }

  function toggleSfx() {
    const s = getSettings();
    s.sfxOn = !s.sfxOn;
    saveQuick(s);
    updateBtns();
  }

  // Wire up all quick buttons
  ["quickMusicBtn", "pauseMusicBtn"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", toggleMusic);
  });
  ["quickSfxBtn", "pauseSfxBtn"].forEach(id => {
    document.getElementById(id)?.addEventListener("click", toggleSfx);
  });

  // Init button states
  updateBtns();
})();