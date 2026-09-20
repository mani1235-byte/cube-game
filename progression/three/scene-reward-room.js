// progression/three/scene-reward-room.js
// Full-screen 3D Reward Room. Click the chest to open it (this is when
// the real loot roll + grant happens via ChestSystem, unchanged) — a
// reward then materializes physically in the room. Walk to it (or click
// it to auto-walk) to collect it, then the room closes itself.
window.RewardRoom3D = (function () {
  const E = window.Engine3D;
  const ROOM = { w: 8, d: 9.5, h: 4.6 };
  const CHEST_POS = { x: ROOM.w / 2, z: ROOM.d - 2.2 };
  const CHEST_IMAGES = {};
  function getChestImage(chestId) {
    const def = window.CHEST_TABLE[chestId];
    if (!def || !def.image) return null;
    if (!CHEST_IMAGES[chestId]) {
      const img = new Image();
      img.src = def.image;
      CHEST_IMAGES[chestId] = img;
    }
    return CHEST_IMAGES[chestId];
  }
  const REWARD_ICON = {
    coins:      "🪙",
    chest:      "📦",
    trophyCase: "🏆",
    world:      "🌍",
    difficulty: "🔥",
    buff:       "⚡",
    xp:         "✨",
    multiplier: "💥",
    heartRefill:"❤️",
    skin:       "🎨",
    trail:      "🌀",
    powerup:    "🛡️",
    title:      "👑",
    emote:      "🎉",
  };

  function open(chestId) {
    const def = window.CHEST_TABLE[chestId];
    if (!def) return null;
    const state = window.ProgressionManager.getState();
    if (!(state.chestInventory || []).includes(chestId)) return null;

    let phase = "closed"; // closed -> opening -> revealed -> collected
    let openT = 0;
    let loot = null;
    let rewardPos = null;
    let api;

    function buildStatic() {
      // 📦 Reward Room — volcanic amber treasure vault
      const faces = E.room(ROOM.w, ROOM.d, ROOM.h, {
        floor: "#1a0900",   // charred obsidian floor
        wallA: "#2a1200",   // deep amber-brown back walls
        wallB: "#331800",   // side walls warm dark red-brown
        ceil:  "#0d0400"    // near-black ceiling
      });
      // ── Lava-crack floor glow veins ───────────────────────────────────────
      [[ROOM.w*0.25, ROOM.d*0.5],[ROOM.w*0.75, ROOM.d*0.4],[ROOM.w*0.5, ROOM.d*0.7]].forEach(([vx,vz]) => {
        faces.push(...E.box(vx, 0.01, vz, 0.06, 0.02, 0.8, "#ff6600", { emissive: true, glow: "#ff9900", alpha: 0.7 }));
        faces.push(...E.box(vx, 0.01, vz, 0.8, 0.02, 0.06, "#ff4400", { emissive: true, glow: "#ff8800", alpha: 0.6 }));
      });
      // ── Wall torch sconces ────────────────────────────────────────────────
      [[0.3, ROOM.d*0.35],[0.3, ROOM.d*0.65],[ROOM.w-0.3, ROOM.d*0.35],[ROOM.w-0.3, ROOM.d*0.65]].forEach(([tx,tz]) => {
        faces.push(...E.box(tx, ROOM.h*0.6, tz, 0.12, 0.25, 0.12, "#ff8800", { emissive: true, glow: "#ffcc00", alpha: 0.9 }));
      });
      // ── Glowing gold floor border ─────────────────────────────────────────
      faces.push(...E.box(ROOM.w/2, 0.01, ROOM.d/2, ROOM.w-0.2, 0.02, ROOM.d-0.2, "#3a1f00", { emissive: true, glow: "#ff6600", alpha: 0.15 }));
      faces.push(...E.box(ROOM.w / 2, 0.32, CHEST_POS.z, 0.55, 0.32, 0.4, "#3a2a18"));
      const solids = [{ x: CHEST_POS.x, z: CHEST_POS.z, r: 0.7 }];
      const interactives = [{ id: "chest", pos: { x: CHEST_POS.x, y: 0.95, z: CHEST_POS.z }, hitRadiusPx: 58, kind: "chest" }];
      return { faces, solids, interactives };
    }

    function startOpen() {
      if (phase !== "closed") return;
      phase = "opening";
      openT = 0;
      api.setHint("Opening...");
      loot = window.ChestSystem.open(chestId); // unchanged game logic: rolls loot, applies it on its own timer
      api.removeInteractive("chest");
      setTimeout(() => {
        phase = "revealed";
        rewardPos = { x: CHEST_POS.x, z: CHEST_POS.z - 1.7 };
        api.addInteractive({ id: "reward", pos: { x: rewardPos.x, y: 1.1, z: rewardPos.z }, hitRadiusPx: 58, kind: "reward" });
        api.setHint("Walk to your reward to collect it (or click it)");
      }, 850);
    }

    function collect() {
      if (phase !== "revealed") return;
      phase = "collected";
      api.removeInteractive("reward");
      api.toast(`${loot ? loot.icon : "🎁"} ${loot ? loot.label : "Reward collected!"}`, 1800);
      setTimeout(() => api.close(), 1600);
    }

    function buildDynamic(t) {
      const faces = [];
      const sprites = [];

      // chest visual, shaking while opening
      const shakeX = phase === "opening" ? Math.sin(t * 30) * 0.04 : 0;
      const chestImg = getChestImage(chestId);
      if ((phase === "closed" || phase === "opening") && chestImg) {
        // Real chest artwork — shown before/while opening so the player
        // sees exactly which chest (wooden/silver/gold/crystal/legendary) it is.
        sprites.push({
          pos: { x: CHEST_POS.x + shakeX, y: 0.85, z: CHEST_POS.z },
          draw(ctx, sx, sy, scale) {
            if (!chestImg.complete || !chestImg.naturalWidth) return;
            const size = 150 * scale;
            const ratio = chestImg.naturalHeight / chestImg.naturalWidth || 1;
            ctx.save();
            ctx.shadowColor = def.glow;
            ctx.shadowBlur = (phase === "opening" ? 30 : 16) * scale;
            ctx.drawImage(chestImg, sx - size / 2, sy - (size * ratio) / 2, size, size * ratio);
            ctx.restore();
          }
        });
      } else {
        // Fallback if no artwork is available for this chest
        const lit = phase === "closed" ? def.color : def.glow;
        faces.push(...E.box(ROOM.w / 2 + shakeX, 0.62, CHEST_POS.z, 0.5, 0.3, 0.36, lit, phase !== "closed" ? { emissive: true, glow: def.glow } : {}));
        if (phase === "closed" || phase === "opening") {
          faces.push(...E.box(ROOM.w / 2 + shakeX, 0.98, CHEST_POS.z, 0.36, 0.08, 0.3, def.glow, phase === "opening" ? { emissive: true, glow: def.glow } : {}));
        }
      }

      if (phase === "revealed" || phase === "collected") {
        // burst glow at chest
        sprites.push({
          pos: { x: CHEST_POS.x, y: 1.3, z: CHEST_POS.z },
          draw(ctx, sx, sy, scale) {
            const r = 70 * scale;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
            g.addColorStop(0, def.glow + "aa"); g.addColorStop(1, def.glow + "00");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
          }
        });
      }

      if (rewardPos && phase !== "collected") {
        const bob = Math.sin(t * 2.4) * 0.12;
        const icon = loot ? (REWARD_ICON[loot.type] || loot.icon || "🎁") : "🎁";
        sprites.push({
          pos: { x: rewardPos.x, y: 1.15 + bob, z: rewardPos.z },
          draw(ctx, sx, sy, scale) {
            ctx.save();
            ctx.shadowColor = def.glow; ctx.shadowBlur = 26 * scale;
            ctx.font = (54 * scale) + "px sans-serif";
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(icon, sx, sy);
            ctx.restore();
          }
        });
        sprites.push({
          pos: { x: rewardPos.x, y: 1.75 + bob, z: rewardPos.z },
          draw(ctx, sx, sy, scale) {
            if (!loot) return;
            ctx.save();
            ctx.font = Math.max(10, 15 * scale) + "px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#000"; ctx.shadowBlur = 5;
            ctx.fillText(loot.label, sx, sy);
            ctx.restore();
          }
        });
      }

      return { faces, sprites };
    }

    function onInteract(it) {
      if (it.kind === "chest") startOpen();
      else if (it.kind === "reward" && rewardPos) {
        api.walkTo(rewardPos.x, rewardPos.z, collect);
      }
    }

    function onUpdate(dt, _api, playerPos) {
      if (phase === "revealed" && rewardPos && api.distanceTo(rewardPos) < 0.85) collect();
    }

    api = E.openScene({
      title: `📦 ${def.name}`,
      hint: "Click the chest to open it",
      roomSize: ROOM,
      spawn: { x: ROOM.w / 2, z: 1.3, yaw: 0 },
      voidColor: "#060200",
      buildStatic,
      buildDynamic,
      onInteract,
      onUpdate
    });
    return api;
  }

  return { open };
})();
