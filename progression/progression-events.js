// progression-events.js
// Minimal pub/sub bus so subsystems (xp, trophies, chests, UI, 3D scene)
// stay decoupled from one another. Everyone talks through this.
window.ProgressionEvents = (function () {
  const listeners = {};

  function on(event, fn) {
    (listeners[event] = listeners[event] || []).push(fn);
    return () => off(event, fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, payload) {
    (listeners[event] || []).slice().forEach(fn => {
      try { fn(payload); } catch (err) { console.error(`[ProgressionEvents] "${event}" listener error:`, err); }
    });
  }

  return { on, off, emit };
})();
