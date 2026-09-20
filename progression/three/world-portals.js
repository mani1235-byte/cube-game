// three/world-portals.js
// Spawns one Portals.makePortal() instance per entry in WORLDS and renders
// them along the bottom of the screen as a quick-travel strip; clicking a
// portal travels the same as the world-ui.js buttons. Locked worlds render
// dimmed with a lock glyph until WorldSystem.unlock() fires.
window.WorldPortals = (function () {
  let portals = [];
  let layerId = "world-portals";
  let clickBound = false;

  function build() {
    const worlds = window.WORLDS || [];
    const spacing = Math.min(120, window.innerWidth / (worlds.length + 1));
    portals = worlds.map((w, i) => ({
      world: w,
      portal: window.Portals.makePortal({
        x: spacing * (i + 1),
        y: window.innerHeight - 50,
        color: w.portalColor,
        locked: !window.WorldSystem.isUnlocked(w.id)
      })
    }));

    window.ProgressionScene.unregisterLayer(layerId);
    window.ProgressionScene.registerLayer({
      id: layerId,
      update(dt) { portals.forEach(p => p.portal.update(dt)); },
      draw(ctx) { portals.forEach(p => p.portal.draw(ctx)); }
    });

    if (!clickBound) { document.addEventListener("click", onClick); clickBound = true; }
  }

  function onClick(e) {
    const hit = portals.find(p => {
      const dx = e.clientX - p.portal.x, dy = e.clientY - p.portal.y;
      return Math.sqrt(dx * dx + dy * dy) < p.portal.radius + 10;
    });
    if (hit && window.WorldSystem.isUnlocked(hit.world.id)) {
      window.WorldSystem.travelTo(hit.world.id);
    }
  }

  function syncLockStates() {
    portals.forEach(p => { p.portal.locked = !window.WorldSystem.isUnlocked(p.world.id); });
  }

  window.ProgressionEvents.on("progression:ready", build);
  window.ProgressionEvents.on("world:unlocked", syncLockStates);
  window.addEventListener("resize", () => { if (portals.length) build(); });

  return { build, syncLockStates };
})();
