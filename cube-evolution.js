// cube-evolution.js
// DEPENDS ON: script.js (must load after it)
// Evolves cube appearance as the game progresses.
// Drop this file in your folder and add:
//   <script src="./cube-evolution.js"></script>
// AFTER script.js in index.html — no changes to script.js needed.
// ============================================================================

// ── Evolution Stages ────────────────────────────────────────────────────────
// Each stage activates at a certain score threshold.
// Changes: cube color palette, glow, size boost, speed tint, trail color.

const EVOLUTION_STAGES = [
  {
    score: 0,
    name: "Normal",
    description: "Standard cubes",
    colors: null,          // null = use original game colors
    glowColor: null,
    glowBlur: 0,
    sizeBoost: 1.0,
    trailColor: "rgba(170,221,255,.62)",
    sparkColor: "rgba(170,221,255,.9)",
  },
  {
    score: 500,
    name: "Heated",
    description: "Cubes glow warm",
    colors: [
      { r: 0xfe, g: 0x95, b: 0x22 }, // orange
      { r: 0xfa, g: 0x24, b: 0x73 }, // pink
      { r: 0xff, g: 0xcc, b: 0x00 }, // yellow
      { r: 0xff, g: 0x55, b: 0x00 }, // red-orange
    ],
    glowColor: "rgba(255,140,0,0.35)",
    glowBlur: 18,
    sizeBoost: 1.0,
    trailColor: "rgba(255,160,50,.7)",
    sparkColor: "rgba(255,180,80,.9)",
  },
  {
    score: 1500,
    name: "Electric",
    description: "Cyan lightning cubes",
    colors: [
      { r: 0x00, g: 0xff, b: 0xff }, // cyan
      { r: 0x67, g: 0xd7, b: 0xf0 }, // light blue
      { r: 0x00, g: 0xcc, b: 0xff }, // sky blue
      { r: 0xa6, g: 0xe0, b: 0x2c }, // electric green
    ],
    glowColor: "rgba(0,220,255,0.4)",
    glowBlur: 22,
    sizeBoost: 1.05,
    trailColor: "rgba(0,220,255,.75)",
    sparkColor: "rgba(0,255,255,1)",
  },
  {
    score: 3000,
    name: "Inferno",
    description: "Fire cubes burn bright",
    colors: [
      { r: 0xff, g: 0x22, b: 0x00 }, // fire red
      { r: 0xff, g: 0x77, b: 0x00 }, // fire orange
      { r: 0xff, g: 0xdd, b: 0x00 }, // fire yellow
      { r: 0xff, g: 0x44, b: 0x44 }, // hot pink-red
    ],
    glowColor: "rgba(255,60,0,0.45)",
    glowBlur: 28,
    sizeBoost: 1.08,
    trailColor: "rgba(255,100,0,.8)",
    sparkColor: "rgba(255,200,0,1)",
  },
  {
    score: 6000,
    name: "Void",
    description: "Dark matter cubes",
    colors: [
      { r: 0x88, g: 0x00, b: 0xff }, // purple
      { r: 0xcc, g: 0x00, b: 0xff }, // violet
      { r: 0xff, g: 0x00, b: 0xcc }, // magenta
      { r: 0x44, g: 0x00, b: 0xcc }, // deep purple
    ],
    glowColor: "rgba(160,0,255,0.45)",
    glowBlur: 30,
    sizeBoost: 1.1,
    trailColor: "rgba(180,0,255,.8)",
    sparkColor: "rgba(220,100,255,1)",
  },
  {
    score: 10000,
    name: "RAINBOW",
    description: "Full spectrum chaos!",
    colors: null,          // handled specially — cycles hue per frame
    glowColor: null,       // handled specially
    glowBlur: 35,
    sizeBoost: 1.15,
    trailColor: null,      // rainbow trail
    sparkColor: null,      // rainbow sparks
    rainbow: true,
  },
];

// ── Stage tracking ──────────────────────────────────────────────────────────
let currentStageIndex = 0;
let stageAnnouncementTimer = 0;
let hueOffset = 0; // for rainbow mode

function getCurrentStage() {
  let stage = EVOLUTION_STAGES[0];
  for (const s of EVOLUTION_STAGES) {
    if (state.game.score >= s.score) stage = s;
  }
  return stage;
}

// ── Patch shadeColor to apply evolution tint ────────────────────────────────
const _originalShadeColor = shadeColor;

function evoShadeColor(color, lightness) {
  const stage = getCurrentStage();
  if (!stage.colors || stage.rainbow) return _originalShadeColor(color, lightness);

  // Only tint cubes that are NOT the special PINK (strong) or wireframe BLUE
  // (slowmo) — those keep their identity.
  const isPink   = color.r === PINK.r   && color.g === PINK.g;
  const isSpecialBlue = color.r === BLUE.r && color.g === BLUE.b;
  if (isPink || isSpecialBlue) return _originalShadeColor(color, lightness);

  // Pick a replacement from the stage palette based on original hue
  const idx = Math.abs((color.r * 3 + color.g * 5 + color.b * 7)) % stage.colors.length;
  return _originalShadeColor(stage.colors[idx], lightness);
}

// Override shadeColor globally (script.js already declared it with const,
// so we shadow it on window which the canvas drawing code will pick up via
// the patched draw path below).
window._evoShadeColor = evoShadeColor;

// ── Rainbow color generator ─────────────────────────────────────────────────
function hslToRgb(h, s, l) {
  h = h % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if      (h < 60)  { r=c; g=x; b=0; }
  else if (h < 120) { r=x; g=c; b=0; }
  else if (h < 180) { r=0; g=c; b=x; }
  else if (h < 240) { r=0; g=x; b=c; }
  else if (h < 300) { r=x; g=0; b=c; }
  else              { r=c; g=0; b=x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function getRainbowColor(offset = 0) {
  return hslToRgb((hueOffset + offset) % 360, 100, 55);
}

// ── Patch the canvas draw loop ──────────────────────────────────────────────
// We intercept each frame by overriding requestAnimationFrame indirectly.
// Instead, we hook into the existing rAF loop by patching the draw function.

const _originalDraw = draw;

window.draw = function(ctx, width, height, viewScale) {
  const stage = getCurrentStage();

  // Update rainbow hue
  hueOffset = (hueOffset + 1.5) % 360;

  // ── Glow effect on canvas ────────────────────────────────────────────────
  if (stage.glowBlur > 0) {
    const glowColor = stage.rainbow
      ? `hsla(${hueOffset}, 100%, 60%, 0.35)`
      : stage.glowColor;
    ctx.shadowBlur  = stage.glowBlur;
    ctx.shadowColor = glowColor;
  } else {
    ctx.shadowBlur = 0;
  }

  // ── Patch poly colors for rainbow ────────────────────────────────────────
  if (stage.rainbow) {
    allPolys.forEach((p, i) => {
      if (!p.wireframe) {
        // Give each poly a slightly offset hue so faces shimmer
        const faceHue = (hueOffset + i * 37) % 360;
        p._rainbowColor = hslToRgb(faceHue, 100, 55);
        p._origColor    = p.color;
        p.color         = p._rainbowColor;
      }
    });
  }

  // ── Run original draw ────────────────────────────────────────────────────
  _originalDraw(ctx, width, height, viewScale);

  // ── Restore original colors after draw ───────────────────────────────────
  if (stage.rainbow) {
    allPolys.forEach(p => {
      if (p._origColor) { p.color = p._origColor; p._origColor = null; }
    });
  }

  // ── Reset shadow so HUD / menus aren't glowing ───────────────────────────
  ctx.shadowBlur = 0;

  // ── Draw stage announcement overlay ──────────────────────────────────────
  if (stageAnnouncementTimer > 0) {
    stageAnnouncementTimer--;
    const alpha = Math.min(1, stageAnnouncementTimer / 30);
    const stage2 = getCurrentStage();
    const glowC  = stage2.rainbow ? `hsla(${hueOffset},100%,60%,${alpha * 0.6})` : null;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font        = `bold ${Math.round(width * 0.045)}px monospace`;
    ctx.textAlign   = "center";

    if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 20; }

    ctx.fillStyle = "#ffffff";
    ctx.fillText(`⚡ ${stage2.name.toUpperCase()} MODE`, 0, -height * 0.28);

    ctx.font      = `bold ${Math.round(width * 0.022)}px monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(stage2.description, 0, -height * 0.28 + Math.round(width * 0.05));

    ctx.restore();
  }
};

// ── Stage transition detector ───────────────────────────────────────────────
// Runs each frame via the existing tick loop (we patch tick).

const _originalTick = tick;

window.tick = function(width, height, simTime, simSpeed, lag) {
  _originalTick(width, height, simTime, simSpeed, lag);

  // Detect stage change
  const newStageIndex = EVOLUTION_STAGES.findIndex(
    (s, i) =>
      state.game.score >= s.score &&
      (i === EVOLUTION_STAGES.length - 1 || state.game.score < EVOLUTION_STAGES[i + 1].score)
  );
  if (newStageIndex !== -1 && newStageIndex !== currentStageIndex) {
    currentStageIndex    = newStageIndex;
    stageAnnouncementTimer = 180; // ~3 seconds at 60fps
  }
};

// ── Patch shadeColor used inside draw ───────────────────────────────────────
// script.js uses `shadeColor` directly (not window.shadeColor), so we replace
// the poly fillStyle assignment by patching fillStyle via the draw wrapper above.
// For non-rainbow stages we also swap poly colors before draw is called.

const _origDrawPolysSection = null; // handled via the draw wrapper + color swaps

// Pre-draw hook: tint non-rainbow, non-special cubes with stage palette.
const _originalDrawPre = window.draw;
window.draw = function(ctx, width, height, viewScale) {
  const stage = getCurrentStage();

  if (stage.colors && !stage.rainbow) {
    allPolys.forEach(p => {
      const c = p.color;
      if (!c) return;
      const isPink = c.r === PINK.r && c.g === PINK.g && c.b === PINK.b;
      const isWireBlue = p.wireframe;
      if (isPink || isWireBlue) return;

      const idx = ((c.r * 3 + c.g * 5 + c.b * 7) & 0xffff) % stage.colors.length;
      p._origColor = p.color;
      p.color = stage.colors[idx];
    });
  }

  _originalDrawPre(ctx, width, height, viewScale);

  // Restore
  if (stage.colors && !stage.rainbow) {
    allPolys.forEach(p => {
      if (p._origColor) { p.color = p._origColor; p._origColor = null; }
    });
  }
};

console.log("🎮 Cube Evolution loaded! Stages:", EVOLUTION_STAGES.map(s => `${s.score}→${s.name}`).join(", "));
