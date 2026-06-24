// three/progression-scene.js
// NOTE: the base game (script.js) renders to <canvas id="c"> with plain
// Canvas2D — there's no three.js/WebGL renderer loaded anywhere in this
// project. To keep the "3D" progression effects (chests, portals, trophy
// hall, particles) consistent with the rest of the codebase rather than
// pulling in a whole new rendering stack, this module is a small canvas
// overlay + requestAnimationFrame loop that the other three/*.js files
// register layers into. If a real three.js renderer is added later, swap
// this file's internals and the public registerLayer/unregisterLayer API
// can stay the same.
window.ProgressionScene = (function () {
  let canvas, ctx, running = false;
  const layers = []; // { id, update(dt), draw(ctx) }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.id = "prog-scene-canvas";
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", pointerEvents: "none", zIndex: 8500
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function registerLayer(layer) {
    layers.push(layer);
    if (!running) start();
    return () => unregisterLayer(layer.id);
  }

  function unregisterLayer(id) {
    const idx = layers.findIndex(l => l.id === id);
    if (idx !== -1) layers.splice(idx, 1);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    layers.forEach(l => {
      l.update && l.update(dt);
      l.draw && l.draw(ctx);
    });
    requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    ensureCanvas();
    requestAnimationFrame(loop);
  }

  return { registerLayer, unregisterLayer, start };
})();

// expose the hook progression-init.js looks for
window.initProgressionScene = function () { window.ProgressionScene.start(); };
