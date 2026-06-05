// intro-effects.js — CUBE GAME Phase 5: Modern Cinematic Intro
// VHS glitch, typing animation, noise overlay, slow zoom, cinematic subtitles
// ============================================================================
(function () {
  "use strict";

  // Only runs on intro page
  if (!document.getElementById("introCanvas")) return;

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. NOISE OVERLAY (film grain)
  // ═══════════════════════════════════════════════════════════════════════════
  const noiseCanvas = document.createElement("canvas");
  noiseCanvas.id = "noise-overlay";
  noiseCanvas.style.cssText = `
    position: fixed; inset: 0; width: 100%; height: 100%;
    pointer-events: none; z-index: 90; opacity: 0.045;
    mix-blend-mode: overlay;
  `;
  document.body.appendChild(noiseCanvas);
  const nctx = noiseCanvas.getContext("2d");

  let nW = 0, nH = 0;
  function resizeNoise() {
    nW = noiseCanvas.width  = window.innerWidth;
    nH = noiseCanvas.height = window.innerHeight;
  }
  resizeNoise();
  window.addEventListener("resize", resizeNoise);

  // Draw film grain every 3 frames
  let noiseTick = 0;
  let noiseImageData = null;
  function drawNoise() {
    noiseTick++;
    if (noiseTick % 3 !== 0) return;
    if (!noiseImageData || noiseImageData.width !== nW) {
      noiseImageData = nctx.createImageData(nW, nH);
    }
    const data = noiseImageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      data[i] = data[i+1] = data[i+2] = v;
      data[i+3] = 28;
    }
    nctx.putImageData(noiseImageData, 0, 0);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. VHS GLITCH SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════
  const glitchStyle = document.createElement("style");
  glitchStyle.textContent = `
    /* VHS scanlines */
    #vhs-scanlines {
      position: fixed; inset: 0; pointer-events: none; z-index: 89;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 3px,
        rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px
      );
      animation: vhsFlicker 0.15s steps(1) infinite;
    }
    @keyframes vhsFlicker {
      0%   { opacity: 1; }
      50%  { opacity: 0.92; }
      100% { opacity: 1; }
    }

    /* Glitch RGB split */
    .vhs-glitch {
      animation: vhsGlitch 0.12s steps(2) forwards;
    }
    @keyframes vhsGlitch {
      0%   { filter: none; transform: none; }
      25%  { filter: hue-rotate(90deg) saturate(2); transform: translateX(4px) skewX(2deg); clip-path: inset(20% 0 60% 0); }
      50%  { filter: hue-rotate(-90deg); transform: translateX(-3px) skewX(-1deg); clip-path: inset(60% 0 10% 0); }
      75%  { filter: brightness(1.5) contrast(1.3); transform: translateX(2px); }
      100% { filter: none; transform: none; clip-path: none; }
    }

    /* Typing cursor */
    .typing-cursor {
      display: inline-block;
      width: 2px; height: 1em;
      background: currentColor;
      margin-left: 2px;
      vertical-align: middle;
      animation: blink 0.7s step-end infinite;
    }
    @keyframes blink { 50% { opacity: 0; } }

    /* scene backgrounds keep their own animations */
    .scene__bg { transform-origin: center center; }

    /* Cinematic subtitles */
    .cin-subtitle {
      position: fixed;
      bottom: 72px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 95;
      font-family: 'Share Tech Mono', monospace;
      font-size: clamp(11px, 1.4vw, 15px);
      color: rgba(255,255,255,0.88);
      text-align: center;
      letter-spacing: 0.12em;
      text-shadow: 0 1px 8px rgba(0,0,0,0.9);
      background: rgba(0,0,0,0.45);
      padding: 6px 18px;
      border-radius: 3px;
      border-top: 1px solid rgba(103,215,240,0.25);
      max-width: 600px;
      white-space: nowrap;
      opacity: 0;
      transition: opacity 0.35s ease;
      pointer-events: none;
    }
    .cin-subtitle.visible { opacity: 1; }

    /* VHS timestamp */
    #vhs-timestamp {
      position: fixed;
      top: 16px; left: 16px;
      font-family: 'Share Tech Mono', monospace;
      font-size: 11px;
      color: rgba(255,255,255,0.45);
      z-index: 96;
      pointer-events: none;
      letter-spacing: 0.1em;
    }

    /* cube-wrap and hero-cube keep their own animations from intro.css */
  `;
  document.head.appendChild(glitchStyle);

  // ── VHS scanlines overlay ──
  const scanlines = document.createElement("div");
  scanlines.id = "vhs-scanlines";
  document.body.appendChild(scanlines);

  // ── VHS timestamp ──
  const timestamp = document.createElement("div");
  timestamp.id = "vhs-timestamp";
  document.body.appendChild(timestamp);

  function updateTimestamp() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    timestamp.textContent = `REC ● ${hh}:${mm}:${ss}`;
  }
  setInterval(updateTimestamp, 1000);
  updateTimestamp();

  // ── Cinematic subtitle element ──
  const subtitle = document.createElement("div");
  subtitle.className = "cin-subtitle";
  document.body.appendChild(subtitle);

  // Subtitle data per scene
  const SUBTITLES = {
    scene1: ["In the beginning...", "Before there was order — only darkness.", "And then: one cube."],
    scene2: ["One became many.", "Each cube: a new threat.", "The multiplication begins."],
    scene3: ["Order collapsed.", "The cubes turned hostile.", "The world trembled."],
    scene4: ["One player. One blade.", "The hero rises.", "Armed with courage and reflex."],
    scene5: ["Normal... Heated... Electric...", "Inferno... Void... Rainbow.", "Each level harder than the last."],
    scene6: ["The legend starts now.", "Are you ready?", "CUBE GAME — Begin your story."],
  };

  let subtitleTimeout = null;
  let subtitleIdx = 0;

  function showSubtitles(sceneId) {
    clearTimeout(subtitleTimeout);
    subtitleIdx = 0;
    const lines = SUBTITLES[sceneId] || [];
    if (!lines.length) { subtitle.classList.remove("visible"); return; }

    function showNext() {
      if (subtitleIdx >= lines.length) {
        subtitle.classList.remove("visible");
        return;
      }
      subtitle.textContent = lines[subtitleIdx++];
      subtitle.classList.add("visible");
      subtitleTimeout = setTimeout(() => {
        subtitle.classList.remove("visible");
        setTimeout(showNext, 600);
      }, 2800);
    }
    setTimeout(showNext, 800);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TYPING ANIMATION — replaces static line text
  // ═══════════════════════════════════════════════════════════════════════════
  function typeText(el, text, speed = 38) {
    return new Promise(resolve => {
      el.textContent = "";
      // Add cursor
      const cursor = document.createElement("span");
      cursor.className = "typing-cursor";
      el.appendChild(cursor);

      let i = 0;
      function next() {
        if (i >= text.length) {
          cursor.remove();
          resolve();
          return;
        }
        // Insert before cursor
        el.insertBefore(document.createTextNode(text[i]), cursor);
        i++;
        setTimeout(next, speed + Math.random() * 20);
      }
      next();
    });
  }

  // Patch scene line reveal: apply typing to .line--small elements
  function patchSceneLines(sceneEl) {
    const smallLines = sceneEl.querySelectorAll(".line--small");
    smallLines.forEach(line => {
      const originalText = line.textContent.trim();
      if (!originalText || line._typingPatched) return;
      line._typingPatched = true;
      line._originalText = originalText;
      line.dataset.type = "typing";
    });
  }

  // Hook into line visibility — intercept class add
  const origAddClass = DOMTokenList.prototype.add;
  DOMTokenList.prototype.add = function(...args) {
    origAddClass.apply(this, args);
    if (args.includes("visible") && this._element) {
      const el = this._element;
      if (el.dataset.type === "typing" && el._originalText) {
        el.textContent = "";
        typeText(el, el._originalText, 42);
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. VHS GLITCH TRIGGER — random + on scene change
  // ═══════════════════════════════════════════════════════════════════════════
  let lastGlitchScene = -1;

  function triggerGlitch(targetEl) {
    const el = targetEl || document.querySelector(".scene.active");
    if (!el) return;
    el.classList.add("vhs-glitch");
    setTimeout(() => el.classList.remove("vhs-glitch"), 150);
  }

  // Random micro-glitches
  function scheduleRandomGlitch() {
    const delay = 3000 + Math.random() * 7000;
    setTimeout(() => {
      triggerGlitch();
      scheduleRandomGlitch();
    }, delay);
  }
  scheduleRandomGlitch();

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SLOW ZOOM — patch activateScene to add subtitle + glitch + zoom
  // ═══════════════════════════════════════════════════════════════════════════
  let _watchInterval = setInterval(() => {
    // Wait for intro.js to define activateScene globally or patch via scene change
    const scenes = document.querySelectorAll(".scene");
    if (!scenes.length) return;

    // Watch for active scene changes via MutationObserver
    const observer = new MutationObserver(muts => {
      muts.forEach(m => {
        if (m.type === "attributes" && m.attributeName === "class") {
          const el = m.target;
          if (el.classList.contains("active") && el.classList.contains("scene")) {
            const sceneId = el.id;
            // Subtitle
            showSubtitles(sceneId);
            // Glitch on scene change
            triggerGlitch(el);
            // Patch typing on lines
            patchSceneLines(el);
          }
        }
      });
    });

    scenes.forEach(s => observer.observe(s, { attributes: true }));
    clearInterval(_watchInterval);
    console.log("🎥 IntroEffects: scene observer active");
  }, 200);

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RAF — noise grain every frame
  // ═══════════════════════════════════════════════════════════════════════════
  function frame() {
    requestAnimationFrame(frame);
    drawNoise();
  }
  frame();

  console.log("🎥 IntroEffects Phase 5 loaded!");
})();
