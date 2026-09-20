// ui/coin-ui.js
(function () {
  let countEl;

  function build() {
    const root = document.createElement("div");
    root.id = "prog-coin-counter";
    root.className = "prog-widget prog-coin-widget";
    root.innerHTML = `🪙 <span id="prog-coin-count">0</span>`;
    document.body.appendChild(root);
    countEl = root.querySelector("#prog-coin-count");
  }

  function refresh() {
    countEl.textContent = window.CoinSystem.getBalance();
  }

  function floatGain(amount) {
    const el = document.createElement("div");
    el.className = "prog-coin-float";
    el.textContent = "+" + amount;
    countEl.parentElement.appendChild(el);
    requestAnimationFrame(() => el.classList.add("prog-coin-float-go"));
    setTimeout(() => el.remove(), 900);
  }

  window.CoinUI = { build, refresh };

  window.ProgressionEvents.on("progression:ready", () => { build(); refresh(); });
  window.ProgressionEvents.on("coins:earned", ({ amount }) => { refresh(); floatGain(amount); });
  window.ProgressionEvents.on("coins:spent", refresh);
})();
