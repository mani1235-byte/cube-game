// audio-reactive.js — CUBE GAME Phase 4: Audio Reactive Effects
// Web Audio API AnalyserNode → logo pulse, light beats, background motion
// ============================================================================
(function () {
  "use strict";

  // ── Wait for DOM + SOUND system ──────────────────────────────────────────
  let _initAttempts = 0;
  function tryInit() {
    _initAttempts++;
    if (_initAttempts > 80) return;
    if (!window.SOUND) { setTimeout(tryInit, 150); return; }
    init();
  }

  function init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    // ── Create AudioContext + AnalyserNode ─────────────────────────────
    let actx = null;
    let analyser = null;
    let dataArray = null;
    let connected = false;

    function buildAnalyser() {
      if (connected) return;
      try {
        actx = new AudioCtx();
        analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.78;
        const bufLen = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufLen);

        // Connect all <audio> elements currently on page + future ones
        function connectAudio(el) {
          try {
            if (el._arConnected) return;
            el._arConnected = true;
            const src = actx.createMediaElementSource(el);
            src.connect(analyser);
            analyser.connect(actx.destination);
          } catch(e) {}
        }

        document.querySelectorAll("audio").forEach(connectAudio);

        // MutationObserver to catch dynamically added <audio>
        new MutationObserver(muts => {
          muts.forEach(m => m.addedNodes.forEach(n => {
            if (n.tagName === "AUDIO") connectAudio(n);
          }));
        }).observe(document.body, { childList: true, subtree: true });

        connected = true;
        console.log("🎵 AudioReactive: AnalyserNode connected");
      } catch(e) {
        console.warn("AudioReactive init failed:", e);
      }
    }

    // Unlock on first user gesture
    document.addEventListener("pointerdown", () => {
      buildAnalyser();
      if (actx && actx.state === "suspended") actx.resume();
    }, { once: true });

    // ── Beat detection ─────────────────────────────────────────────────
    // Returns { bass, mid, treble, energy, isBeat }
    let lastEnergy = 0;
    let beatCooldown = 0;

    function getAudioData() {
      if (!analyser || !dataArray) {
        return { bass: 0, mid: 0, treble: 0, energy: 0, isBeat: false };
      }
      analyser.getByteFrequencyData(dataArray);

      const len = dataArray.length;
      let bass = 0, mid = 0, treble = 0;

      // Bass: bins 0–10 (~0–500 Hz)
      for (let i = 0; i < 10; i++) bass += dataArray[i];
      bass = bass / (10 * 255);

      // Mid: bins 10–50
      for (let i = 10; i < 50; i++) mid += dataArray[i];
      mid = mid / (40 * 255);

      // Treble: bins 50–128
      for (let i = 50; i < Math.min(128, len); i++) treble += dataArray[i];
      treble = treble / (78 * 255);

      const energy = (bass * 0.6 + mid * 0.3 + treble * 0.1);

      // Beat: energy spike > threshold, with cooldown
      beatCooldown = Math.max(0, beatCooldown - 1);
      const isBeat = beatCooldown === 0 && energy > lastEnergy * 1.3 && energy > 0.2;
      if (isBeat) beatCooldown = 8;
      lastEnergy = energy * 0.85 + lastEnergy * 0.15;

      return { bass, mid, treble, energy, isBeat };
    }

    // ── Logo pulse ─────────────────────────────────────────────────────
    const logo = document.querySelector(".page-logo");
    let logoPulse = 1;

    function updateLogo(bass, isBeat) {
      if (!logo) return;
      // Smooth pulse toward bass value, spike on beat
      const target = 1 + bass * 0.18 + (isBeat ? 0.12 : 0);
      logoPulse += (target - logoPulse) * 0.15;

      logo.style.transform = `scale(${logoPulse.toFixed(4)})`;
      logo.style.filter    = `drop-shadow(0 0 ${(bass * 24).toFixed(1)}px rgba(103,215,240,${(bass * 0.8).toFixed(2)}))`;
      logo.style.transition = "transform 0.05s, filter 0.05s";
    }

    // ── Dynamic light beats (talks to particles.js) ────────────────────
    let beatLightCooldown = 0;
    const beatColors = [
      { r: 103, g: 215, b: 240 },
      { r: 250, g:  36, b: 115 },
      { r: 166, g: 224, b:  44 },
      { r: 254, g: 149, b:  34 },
    ];
    let beatColorIdx = 0;

    function updateLights(bass, mid, isBeat) {
      if (!window.CubeParticles) return;
      if (isBeat && beatLightCooldown === 0) {
        const color = beatColors[beatColorIdx % beatColors.length];
        beatColorIdx++;
        // Spawn 2 beat lights at random positions
        for (let i = 0; i < 2; i++) {
          CubeParticles.addLight(
            Math.random() * window.innerWidth,
            Math.random() * window.innerHeight,
            color,
            120 + bass * 200,
            0.9 + bass * 0.5,
            0.5 + bass * 0.3
          );
        }
        beatLightCooldown = 12;
      }
      beatLightCooldown = Math.max(0, beatLightCooldown - 1);
    }

    // ── Background reactive canvas ─────────────────────────────────────
    const bgCanvas = document.createElement("canvas");
    bgCanvas.id = "audio-bg";
    bgCanvas.style.cssText = `
      position: fixed; inset: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 1;
      opacity: 0.55;
      mix-blend-mode: screen;
    `;
    document.body.insertBefore(bgCanvas, document.body.firstChild);
    const bgCtx = bgCanvas.getContext("2d");

    let bgW = window.innerWidth, bgH = window.innerHeight;
    function resizeBg() {
      bgW = window.innerWidth; bgH = window.innerHeight;
      bgCanvas.width = bgW; bgCanvas.height = bgH;
    }
    resizeBg();
    window.addEventListener("resize", resizeBg);

    // Wave state
    const waves = [
      { phase: 0, speed: 0.012, amp: 0.04, color: { r: 103, g: 215, b: 240 } },
      { phase: 1.5, speed: 0.009, amp: 0.03, color: { r: 250, g:  36, b: 115 } },
      { phase: 3.0, speed: 0.015, amp: 0.025, color: { r: 166, g: 224, b:  44 } },
    ];

    function drawBg(bass, mid, treble, energy, isBeat) {
      bgCtx.clearRect(0, 0, bgW, bgH);

      waves.forEach((w, wi) => {
        w.phase += w.speed + mid * 0.04;
        const amp = bgH * (w.amp + bass * 0.08);

        bgCtx.beginPath();
        bgCtx.moveTo(0, bgH * 0.5);

        for (let x = 0; x <= bgW; x += 3) {
          const y = bgH * 0.5
            + Math.sin(x * 0.006 + w.phase) * amp
            + Math.sin(x * 0.003 + w.phase * 0.7) * amp * 0.5;
          bgCtx.lineTo(x, y);
        }
        bgCtx.lineTo(bgW, bgH);
        bgCtx.lineTo(0, bgH);
        bgCtx.closePath();

        const alpha = 0.03 + energy * 0.06 + (isBeat ? 0.04 : 0);
        bgCtx.fillStyle = `rgba(${w.color.r},${w.color.g},${w.color.b},${alpha.toFixed(3)})`;
        bgCtx.fill();
      });

      // Beat flash — full-screen tint
      if (isBeat) {
        const c = beatColors[beatColorIdx % beatColors.length];
        bgCtx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.04)`;
        bgCtx.fillRect(0, 0, bgW, bgH);
      }

      // Bass circles from center
      if (bass > 0.1) {
        const grad = bgCtx.createRadialGradient(bgW/2, bgH/2, 0, bgW/2, bgH/2, bgW * 0.4 * bass);
        grad.addColorStop(0, `rgba(103,215,240,${(bass * 0.08).toFixed(3)})`);
        grad.addColorStop(1, `rgba(103,215,240,0)`);
        bgCtx.fillStyle = grad;
        bgCtx.beginPath();
        bgCtx.arc(bgW/2, bgH/2, bgW * 0.4 * (bass + 0.3), 0, Math.PI * 2);
        bgCtx.fill();
      }
    }

    // ── HUD elements pulse ─────────────────────────────────────────────
    // Score label, cube count — subtle scale on beats
    let hudPulse = 1;
    function updateHud(isBeat, energy) {
      const scoreEl = document.querySelector(".score-lbl");
      const cubeEl  = document.querySelector(".cube-count-lbl");
      if (!scoreEl && !cubeEl) return;

      hudPulse += ((isBeat ? 1.08 : 1) - hudPulse) * 0.2;
      const s = hudPulse.toFixed(4);
      if (scoreEl) scoreEl.style.transform = `scale(${s})`;
      if (cubeEl)  cubeEl.style.transform  = `scale(${s})`;
    }

    // ── Intro scene pulse (if on intro page) ──────────────────────────
    function updateIntroCubes(bass, isBeat) {
      const cubes = document.querySelectorAll(".cube-3d, .hero-cube, .final-cube");
      cubes.forEach(c => {
        const base = 1 + bass * 0.15;
        c.style.transform = (c.style.transform || "").replace(/scale\([^)]+\)/, "")
          + ` scale(${base.toFixed(3)})`;
      });
    }

    // ── Main RAF loop ──────────────────────────────────────────────────
    let rafId = null;
    function tick() {
      rafId = requestAnimationFrame(tick);
      const { bass, mid, treble, energy, isBeat } = getAudioData();
      updateLogo(bass, isBeat);
      updateLights(bass, mid, isBeat);
      drawBg(bass, mid, treble, energy, isBeat);
      updateHud(isBeat, energy);
      updateIntroCubes(bass, isBeat);
    }
    tick();

    // ── Expose public API ──────────────────────────────────────────────
    window.AudioReactive = {
      getAudioData,
      buildAnalyser,
    };

    console.log("🔊 AudioReactive Phase 4 loaded!");
  }

  setTimeout(tryInit, 300);
})();
