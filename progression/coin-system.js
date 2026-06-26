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
