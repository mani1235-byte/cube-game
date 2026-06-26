// chest-animation.js
// Times the chest-open sequence. The actual chest visual now lives entirely
// in three/scene-reward-room.js (the full 3D Reward Room) — this used to
// also fire an old center-screen 2D shake/pop chest sprite (three/chest-model.js)
// as a leftover from before that room existed, which made a second chest
// pop up automatically on top of the Reward Room every time. That's gone now;
// this file just owns timing + the loot-reveal handoff to ui/reward-popup.js.
window.ChestAnimation = (function () {
  const Events = window.ProgressionEvents;

  function play(chestId, onComplete) {
    const def = (window.CHEST_TABLE || {})[chestId];
    const duration = def ? def.openTimeMs : 1200;

    Events.emit("chest:anim_start", { chestId, duration });

    setTimeout(() => {
      Events.emit("chest:anim_end", { chestId });
      onComplete && onComplete();
    }, duration);
  }

  return { play };
})();
