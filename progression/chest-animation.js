// chest-animation.js
// Times the chest-open sequence and hands off to the visual layer
// (three/chest-model.js for the shake/pop, ui/reward-popup.js for the
// loot reveal). Decoupled from chest-system.js so the timing/feel can be
// tuned without touching loot logic.
window.ChestAnimation = (function () {
  const Events = window.ProgressionEvents;

  function play(chestId, onComplete) {
    const def = (window.CHEST_TABLE || {})[chestId];
    const duration = def ? def.openTimeMs : 1200;

    Events.emit("chest:anim_start", { chestId, duration });
    if (window.ChestModel3D) window.ChestModel3D.playOpenSequence(chestId, duration);

    setTimeout(() => {
      Events.emit("chest:anim_end", { chestId });
      onComplete && onComplete();
    }, duration);
  }

  return { play };
})();
