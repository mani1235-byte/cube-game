// progression/three/scene-reward-room.js
// Full-screen 3D Reward Room. Click the chest to open it (this is when
// the real loot roll + grant happens via ChestSystem, unchanged) — a
// reward then materializes physically in the room. Walk to it (or click
// it to auto-walk) to collect it, then the room closes itself.
window.RewardRoom3D = (function () {
  const E = window.Engine3D;
  const ROOM = { w: 8, d: 9.5, h: 4.6 };
  const CHEST_POS = { x: ROOM.w / 2, z: ROOM.d - 2.2 };
  const REWARD_ICON = { coins: "🪙", chest: "📦", trophyCase: "🏆", world: "🌍", difficulty: "🔥", buff: "⚡" };

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
      const faces = E.room(ROOM.w, ROOM.d, ROOM.h, { floor: "#1a140f", wallA: "#241c14", wallB: "#2a2018", ceil: "#120e0a" });
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

      // chest body, shaking while opening
      const shakeX = phase === "opening" ? Math.sin(t * 30) * 0.04 : 0;
      const lit = phase === "closed" ? def.color : def.glow;
      faces.push(...E.box(ROOM.w / 2 + shakeX, 0.62, CHEST_POS.z, 0.5, 0.3, 0.36, lit, phase !== "closed" ? { emissive: true, glow: def.glow } : {}));
      if (phase === "closed" || phase === "opening") {
        faces.push(...E.box(ROOM.w / 2 + shakeX, 0.98, CHEST_POS.z, 0.36, 0.08, 0.3, def.glow, phase === "opening" ? { emissive: true, glow: def.glow } : {}));
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
      voidColor: "#06040a",
      buildStatic,
      buildDynamic,
      onInteract,
      onUpdate
    });
    return api;
  }

  return { open };
})();
