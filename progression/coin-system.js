// coin-system.js
// Bridges progression coins with the existing shop.js coin store
// (cg_current_user.coins) when present, so balances stay in sync across
// the whole game instead of forking into a second currency.
window.CoinSystem = (function () {
  const Events = window.ProgressionEvents;
  let state = null;

  function init(sharedState) {
    state = sharedState;
    state.coins = state.coins || 0;
  }

  function earn(amount, reason) {
    if (!state || amount <= 0) return;
    if (typeof window.grantCoins === "function") {
      // shop.js owns the canonical balance; mirror it locally for offline UI
      state.coins = window.grantCoins(amount);
    } else {
      state.coins += amount;
    }
    Events.emit("coins:earned", { amount, total: state.coins, reason });
    Events.emit("progression:dirty");
    reportEarnToServer(amount, reason);
  }

  // Best-effort report to the server wallet (see server.js's /api/coins/earn)
  // so this earn event actually counts toward what the shop's server-side
  // spend check will allow — not just the client-side display. Fire and
  // forget: if it fails (offline, rate-limited), the local UI still works
  // as before, it just won't be spendable server-side until it succeeds.
  function reportEarnToServer(amount, reason) {
    try {
      if (typeof window.getUser !== "function") return;
      const user = window.getUser();
      if (!user || user.isGuest || !user.username) return;
      const base = (window.CUBE_SERVER || window.location.origin || "").replace(/\/$/, "");
      fetch(`${base}/api/coins/earn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, amount, reason }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) { /* non-fatal — display already updated locally */ }
  }

  function spend(amount) {
    if (!state || amount <= 0) return false;
    if (state.coins < amount) return false;
    if (typeof window.getUser === "function" && typeof window.saveUser === "function") {
      const user = window.getUser();
      if (user) {
        user.coins = Math.max(0, (user.coins || 0) - amount);
        window.saveUser(user);
        state.coins = user.coins;
      }
    } else {
      state.coins -= amount;
    }
    Events.emit("coins:spent", { amount, total: state.coins });
    Events.emit("progression:dirty");
    return true;
  }

  function getBalance() { return state ? state.coins : 0; }

  return { init, earn, spend, getBalance };
})();
