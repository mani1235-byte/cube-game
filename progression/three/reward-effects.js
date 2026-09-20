// three/reward-effects.js
// Lightweight dispatcher so any system can request a named visual effect
// ("confetti", "glow", "sparkle") without knowing how it's implemented.
// Currently routes everything to coin-particles.js / reward-room.js, but
// gives future effects a single place to register.
window.RewardEffects = (function () {
  const handlers = {
    confetti: (opts) => window.CoinParticles && window.CoinParticles.burst(opts.x, opts.y, opts.count || 24, opts.color),
    glow: (opts) => window.RewardRoom && window.RewardRoom.burst(opts.color)
  };

  function play(name, opts = {}) {
    const handler = handlers[name];
    if (handler) handler(opts);
    else console.warn("[RewardEffects] unknown effect:", name);
  }

  function register(name, handler) { handlers[name] = handler; }

  return { play, register };
})();
