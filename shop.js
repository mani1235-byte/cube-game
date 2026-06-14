// shop.js — CUBE GAME Shop: coin packs + item unlocks
// ============================================================================

const CONFIG = {
  paypalEmail:     "alferedobook@gmail.com",
  paypalCurrency:  "USD",
  metamaskAddress: "0x6D08AcBc3910c8eC7A45D8Df8796aEEcfe7A70Bb",
  ethPrices: {
    "50":    "0.00025",
    "200":   "0.001",
    "600":   "0.0025",
    "1500":  "0.005",
    "4000":  "0.01",
    "10000": "0.025",
    "25000": "0.06",
  }
};

// Trail color definitions for in-game use (read by particles.js bridge)
const TRAIL_COLORS = {
  trail_neon:    { r: 103, g: 215, b: 240 },  // cyan
  trail_fire:    { r: 254, g: 100, b:  20 },  // fire orange
  trail_thunder: { r: 166, g: 224, b:  44 },  // electric green
  trail_void:    { r: 180, g:   0, b: 255 },  // void purple
  trail_rainbow: null,                          // cycles — handled separately
  trail_ice:     { r:   0, g: 229, b: 255 },  // ice blue
  trail_gold:    { r: 255, g: 215, b:   0 },  // gold
  trail_shadow:  { r:  80, g:  80, b: 110 },  // dark shadow
};

const ITEM_CATALOGUE = [
  // Trails
  { id:"trail_neon",    name:"Neon Blade",    desc:"Glowing cyan slash trail",       icon:"🔵", gradient:"135deg,#67d7f0,#a6e02c", cost:150,  tag:"trail" },
  { id:"trail_fire",    name:"Fire Slash",    desc:"Scorching orange trail",         icon:"🔥", gradient:"135deg,#fa2473,#fe9522", cost:250,  tag:"trail" },
  { id:"trail_thunder", name:"Thunder Bolt",  desc:"Electric sparks on every slash", icon:"⚡", gradient:"135deg,#a6e02c,#67d7f0", cost:400,  tag:"trail" },
  { id:"trail_void",    name:"Void Rift",     desc:"Dark purple tear trail",         icon:"🌑", gradient:"135deg,#8800ff,#cc00ff", cost:600,  tag:"trail" },
  { id:"trail_rainbow", name:"Rainbow Streak",desc:"Full spectrum flash trail",      icon:"🌈", gradient:"135deg,#ff0000,#00aaff", cost:900,  tag:"trail" },
  { id:"trail_ice",     name:"Frost Blade",   desc:"Icy crystalline trail",          icon:"❄️", gradient:"135deg,#00e5ff,#ffffff", cost:350,  tag:"trail" },
  { id:"trail_gold",    name:"Golden Strike", desc:"Gleaming gold slash trail",      icon:"✨", gradient:"135deg,#ffd700,#ff8c00", cost:750,  tag:"trail" },
  { id:"trail_shadow",  name:"Shadow Claw",   desc:"Black smoke slash trail",        icon:"🖤", gradient:"135deg,#1a1a2e,#16213e", cost:550,  tag:"trail" },
  // Skins
  { id:"skin_royal",    name:"Royal Cube",    desc:"Purple holographic skin+trail",  icon:"👑", gradient:"135deg,#7b2fff,#fa2473", cost:800,  tag:"skin" },
  { id:"skin_diamond",  name:"Diamond Cube",  desc:"Shimmering faceted gem skin",    icon:"💎", gradient:"135deg,#b9f2ff,#a6e02c", cost:1200, tag:"skin" },
  { id:"skin_lava",     name:"Lava Cube",     desc:"Molten rock texture",            icon:"🌋", gradient:"135deg,#ff2200,#ff7700", cost:950,  tag:"skin" },
  { id:"skin_galaxy",   name:"Galaxy Cube",   desc:"Starfield skin on every face",   icon:"🌌", gradient:"135deg,#0f0c29,#302b63", cost:1500, tag:"skin" },
  { id:"skin_ghost",    name:"Ghost Cube",    desc:"Semi-transparent spectral skin", icon:"👻", gradient:"135deg,#c0c0c0,#e8e8e8", cost:700,  tag:"skin" },
  { id:"skin_emerald",  name:"Emerald Cube",  desc:"Deep green gem texture",         icon:"💚", gradient:"135deg,#00c851,#007e33", cost:1100, tag:"skin" },
  { id:"skin_neon_grid",name:"Cyber Grid",    desc:"Tron-style neon wireframe",      icon:"🔲", gradient:"135deg,#00fff0,#001f3f", cost:1800, tag:"skin" },
  { id:"skin_inferno",  name:"Inferno Cube",  desc:"Living fire on every face",      icon:"🔴", gradient:"135deg,#ff4500,#ff9500", cost:2000, tag:"skin" },
  // Power-ups
  { id:"power_slowmo",  name:"Slow-Mo Boost", desc:"+30s extra slow-mo per game",   icon:"🌊", gradient:"135deg,#262e36,#67d7f0", cost:300,  tag:"power" },
  { id:"power_explode", name:"Explosion FX",  desc:"Epic cube-burst particles",     icon:"💥", gradient:"135deg,#fe9522,#a6e02c", cost:500,  tag:"power" },
  { id:"power_shield",  name:"Force Shield",  desc:"Block one hit per game",        icon:"🛡️", gradient:"135deg,#4169e1,#6a5acd", cost:1000, tag:"power" },
  { id:"power_magnet",  name:"Coin Magnet",   desc:"Double coins from gameplay",    icon:"🧲", gradient:"135deg,#cc0000,#880000", cost:1400, tag:"power" },
  { id:"power_x2score", name:"Score Rush",    desc:"2× score multiplier for 60s",  icon:"⬆️", gradient:"135deg,#ffd700,#ff8c00", cost:1200, tag:"power" },
  { id:"power_freeze",  name:"Freeze Ray",    desc:"Freeze all cubes for 5s",       icon:"🧊", gradient:"135deg,#00bcd4,#006064", cost:800,  tag:"power" },
  { id:"power_ghost2",  name:"Phase Through", desc:"Pass through 3 cubes per game", icon:"🌀", gradient:"135deg,#9c27b0,#673ab7", cost:1600, tag:"power" },
  { id:"power_time",    name:"Time Warp",     desc:"Add 30 bonus seconds",          icon:"⏱️", gradient:"135deg,#00897b,#00695c", cost:900,  tag:"power" },
  // Badges
  { id:"badge_rookie",  name:"Rookie",        desc:"Show your starting spirit",     icon:"🌟", gradient:"135deg,#29b6f6,#0288d1", cost:100,  tag:"badge" },
  { id:"badge_slayer",  name:"Cube Slayer",   desc:"Badge shown on leaderboard",    icon:"⚔️", gradient:"135deg,#b71c1c,#880000", cost:500,  tag:"badge" },
  { id:"badge_legend",  name:"Legend",        desc:"Exclusive gold legend badge",   icon:"🏆", gradient:"135deg,#ffd700,#ff8c00", cost:2500, tag:"badge" },
  { id:"badge_void",    name:"Void Walker",   desc:"Rare dark-matter badge",        icon:"🔮", gradient:"135deg,#4a0080,#1a0030", cost:3000, tag:"badge" },
];

const COIN_PACKS = [
  { coins:    50, label:"Trial Pack",   icon:"🥉", usd:"0.49",   eth:"0.00025", badge:"" },
  { coins:   200, label:"Starter Pack", icon:"🪙",  usd:"1.99",   eth:"0.001",  badge:"" },
  { coins:   600, label:"Value Pack",   icon:"💰",  usd:"4.99",   eth:"0.0025", badge:"POPULAR" },
  { coins:  1500, label:"Pro Pack",     icon:"💎",  usd:"9.99",   eth:"0.005",  badge:"BEST VALUE" },
  { coins:  4000, label:"Legend Pack",  icon:"👑",  usd:"19.99",  eth:"0.01",   badge:"" },
  { coins: 10000, label:"Elite Pack",   icon:"🚀",  usd:"49.99",  eth:"0.025",  badge:"HOT" },
  { coins: 25000, label:"Mega Pack",    icon:"🌌",  usd:"119.99", eth:"0.06",   badge:"MEGA" },
];

// ── Expose item data for in-game systems ──────────────────────────────────
window.cgItems = {
  TRAIL_COLORS,
  ITEM_CATALOGUE,
  getUser,
  isItemUnlocked,
  getActiveTrailColor() {
    try {
      const user = getUser();
      if (!user || !user.unlockedItems) return null;
      // Find equipped trail (most recently unlocked one wins; or first match)
      const equipped = user.equippedTrail || null;
      if (equipped && isItemUnlocked(equipped) && TRAIL_COLORS[equipped] !== undefined) {
        return TRAIL_COLORS[equipped]; // null = rainbow
      }
      // Fall back to first owned trail
      for (const id of user.unlockedItems) {
        if (id.startsWith("trail_") && TRAIL_COLORS[id] !== undefined) return TRAIL_COLORS[id];
      }
    } catch (_) {}
    return null;
  },
  isRainbowTrail() {
    try {
      const user = getUser();
      if (!user) return false;
      const equipped = user.equippedTrail;
      if (equipped === "trail_rainbow") return true;
      // Auto-equip rainbow if owned and nothing else chosen
      if (!equipped && user.unlockedItems && user.unlockedItems.includes("trail_rainbow")) return true;
    } catch (_) {}
    return false;
  },
  hasItem: (id) => isItemUnlocked(id),
  equipTrail(id) {
    const user = getUser();
    if (!user) return;
    user.equippedTrail = id;
    saveUser(user);
  }
};

// ── Payment method state ───────────────────────────────────────────────────
let selectedPayment = "paypal";

// ── User helpers ──────────────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(localStorage.getItem("cg_current_user")) || null; } catch (_) { return null; }
}
function saveUser(u) { localStorage.setItem("cg_current_user", JSON.stringify(u)); }

function grantCoins(amount) {
  let user = getUser();
  if (!user) user = { username:"Guest", isGuest:true, coins:0, unlockedItems:[], totalGames:0, highScore:0 };
  user.coins = (user.coins || 0) + amount;
  saveUser(user);
  refreshCoinDisplay(user.coins);
  return user.coins;
}

function refreshCoinDisplay(total) {
  ["paCoins","statCoins","shopCoinCount"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = total;
  });
  renderItemButtons();
}

function unlockItem(itemId) {
  let user = getUser();
  if (!user) return false;
  if (!Array.isArray(user.unlockedItems)) user.unlockedItems = [];
  if (!user.unlockedItems.includes(itemId)) {
    user.unlockedItems.push(itemId);
    // Auto-equip first trail purchased
    if (itemId.startsWith("trail_") && !user.equippedTrail) user.equippedTrail = itemId;
    saveUser(user);
  }
  return true;
}

function isItemUnlocked(itemId) {
  const user = getUser();
  if (!user || !Array.isArray(user.unlockedItems)) return false;
  return user.unlockedItems.includes(itemId);
}

function buyItem(itemId) {
  const item = ITEM_CATALOGUE.find(i => i.id === itemId);
  if (!item) return;
  if (isItemUnlocked(itemId)) { showToast("✅ Already unlocked!"); return; }
  let user = getUser();
  if (!user) { showToast("⚠️ Please log in first!"); return; }
  const balance = user.coins || 0;
  if (balance < item.cost) {
    showToast(`❌ Need ${item.cost.toLocaleString()} 🪙 (you have ${balance.toLocaleString()})`);
    return;
  }
  user.coins = balance - item.cost;
  saveUser(user);
  unlockItem(itemId);
  refreshCoinDisplay(user.coins);
  showToast(`✅ ${item.name} unlocked! 🎉 (−${item.cost} 🪙)`);
  renderItemButtons();
}

function renderItemButtons() {
  document.querySelectorAll(".item-buy[data-item-id]").forEach(btn => {
    const id = btn.dataset.itemId;
    const owned = isItemUnlocked(id);
    btn.textContent = owned ? "✅ OWNED" : "UNLOCK";
    btn.disabled = owned;
    btn.style.opacity = owned ? "0.6" : "";
    btn.style.cursor  = owned ? "default" : "";
  });
  // Update equip buttons
  document.querySelectorAll(".item-equip[data-item-id]").forEach(btn => {
    const id = btn.dataset.itemId;
    const user = getUser();
    const isEquipped = user && user.equippedTrail === id;
    btn.textContent = isEquipped ? "✓ EQUIPPED" : "EQUIP";
    btn.style.background = isEquipped ? "rgba(166,224,44,0.3)" : "";
    btn.style.borderColor = isEquipped ? "#a6e02c" : "";
  });
}

// ── Build item grid ────────────────────────────────────────────────────────
function buildItemGrid() {
  const grid = document.getElementById("dynamicItemGrid");
  if (!grid) return;
  const tags = [
    { key:"trail", label:"🗡️ Slash Trails" },
    { key:"skin",  label:"🎨 Cube Skins" },
    { key:"power", label:"⚡ Power-Ups" },
    { key:"badge", label:"🏅 Titles & Badges" },
  ];
  let html = "";
  tags.forEach(section => {
    const items = ITEM_CATALOGUE.filter(i => i.tag === section.key);
    html += `<div class="item-section-label">${section.label}</div><div class="item-grid">`;
    items.forEach(item => {
      const owned = isItemUnlocked(item.id);
      const isTrail = item.tag === "trail";
      const user = getUser();
      const isEquipped = isTrail && user && user.equippedTrail === item.id;
      html += `
        <div class="item-card${owned ? " item-owned" : ""}">
          <div class="item-preview" style="background:linear-gradient(${item.gradient})">${item.icon}</div>
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${item.desc}</div>
          <div class="item-cost">🪙 ${item.cost.toLocaleString()}</div>
          <button class="buy-btn item-buy" data-item-id="${item.id}" onclick="buyItem('${item.id}')"
            ${owned ? 'disabled style="opacity:0.6;cursor:default"' : ""}>
            ${owned ? "✅ OWNED" : "UNLOCK"}
          </button>
          ${owned && isTrail ? `<button class="buy-btn item-equip" data-item-id="${item.id}"
            onclick="equipTrail('${item.id}')"
            style="${isEquipped ? "background:rgba(166,224,44,0.3);border-color:#a6e02c;" : ""}margin-top:4px;font-size:0.6rem;">
            ${isEquipped ? "✓ EQUIPPED" : "EQUIP"}
          </button>` : ""}
        </div>`;
    });
    html += "</div>";
  });
  grid.innerHTML = html;
}

function equipTrail(id) {
  const user = getUser();
  if (!user) return;
  user.equippedTrail = id;
  saveUser(user);
  showToast(`✅ Trail equipped! Active in next game.`);
  buildItemGrid(); // re-render to show equipped state
}

// ── Build coin grid ────────────────────────────────────────────────────────
function buildCoinGrid() {
  const grid = document.getElementById("dynamicCoinGrid");
  if (!grid) return;
  let html = "";
  COIN_PACKS.forEach(pack => {
    const featured = pack.badge ? " featured" : "";
    const badge    = pack.badge ? `<div class="coin-badge">${pack.badge}</div>` : "";
    html += `
      <div class="coin-card${featured}" data-coins="${pack.coins}">
        ${badge}
        <div class="coin-icon">${pack.icon}</div>
        <div class="coin-amount">${pack.coins.toLocaleString()} Coins</div>
        <div class="coin-name">${pack.label}</div>
        <div class="coin-price-usd coin-price" ${selectedPayment==="metamask"?'style="display:none"':''}>$${pack.usd}</div>
        <div class="coin-price-eth coin-price" ${selectedPayment!=="metamask"?'style="display:none"':''}>Ξ ${pack.eth} ETH</div>
        <button class="buy-btn" onclick="handleBuy('${pack.coins} Coins ${pack.label}','${pack.usd}',${pack.coins})">BUY NOW</button>
      </div>`;
  });
  grid.innerHTML = html;
}

// ── PayPal — proper form POST (actually works, no popup blocking) ──────────
function buyWithPayPal(itemName, price, coins) {
  // Grant coins immediately (optimistic)
  const total = grantCoins(coins);
  showToast(`🪙 +${coins.toLocaleString()} Coins! Total: ${total.toLocaleString()} 🎉`);
  showCoinCelebration(coins);

  // Build a hidden form and submit it (bypasses popup blockers entirely)
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://www.paypal.com/cgi-bin/webscr";
  form.target = "_blank";
  form.style.display = "none";

  const fields = {
    cmd:           "_xclick",
    business:      CONFIG.paypalEmail,
    item_name:     itemName,
    amount:        price,
    currency_code: CONFIG.paypalCurrency,
    return:        window.location.href,
    cancel_return: window.location.href,
    no_shipping:   "1",
    custom:        "coins:" + coins,
  };
  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => form.remove(), 2000);
}

// ── MetaMask ───────────────────────────────────────────────────────────────
async function buyWithMetaMask(itemName, coins, ethAmount) {
  if (typeof window.ethereum === "undefined") {
    showToast("❌ MetaMask not found — install it first!");
    window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
    return;
  }
  try {
    showToast("🦊 Connecting to MetaMask…");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const from = accounts[0];
    const ethInWei = BigInt(Math.round(parseFloat(ethAmount) * 1e18));
    const valueHex = "0x" + ethInWei.toString(16);
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from, to: CONFIG.metamaskAddress, value: valueHex, gas: "0x5208" }],
    });
    const total = grantCoins(coins);
    showToast(`✅ TX sent! +${coins.toLocaleString()} Coins! Total: ${total.toLocaleString()} 🎉`);
    showCoinCelebration(coins);
    console.log("MetaMask TX:", txHash);
  } catch (err) {
    showToast(err.code === 4001 ? "❌ Transaction cancelled." : "❌ " + (err.message || "Error"));
  }
}

function handleBuy(itemName, price, coins) {
  if (selectedPayment === "metamask") {
    buyWithMetaMask(itemName, coins, CONFIG.ethPrices[String(coins)] || "0.001");
  } else {
    buyWithPayPal(itemName, price, coins);
  }
}

// ── Coin celebration ───────────────────────────────────────────────────────
function showCoinCelebration(amount) {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;pointer-events:none";
  overlay.innerHTML = `
    <div style="font-size:clamp(48px,10vw,96px);animation:coinPop .6s ease-out forwards">🪙</div>
    <div style="font-size:clamp(24px,5vw,48px);font-weight:900;color:#ffd700;text-shadow:0 0 20px #ffd700;margin-top:8px;animation:coinPop .6s .1s ease-out both">
      +${amount.toLocaleString()} COINS!
    </div>`;
  if (!document.getElementById("coinPopStyle")) {
    const s = document.createElement("style"); s.id = "coinPopStyle";
    s.textContent = `@keyframes coinPop{0%{transform:scale(0) rotate(-20deg);opacity:0}60%{transform:scale(1.2) rotate(5deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2200);
}

// ── Payment method selector ────────────────────────────────────────────────
function setPaymentMethod(method) {
  selectedPayment = method;
  document.querySelectorAll(".pay-method-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.method === method));
  document.querySelectorAll(".coin-card").forEach(card => {
    const u = card.querySelector(".coin-price-usd");
    const e = card.querySelector(".coin-price-eth");
    if (u) u.style.display = method==="paypal"   ? "" : "none";
    if (e) e.style.display = method==="metamask" ? "" : "none";
  });
  const ppNote = document.getElementById("paypalNote");
  const mmNote = document.getElementById("metamaskNote");
  if (ppNote) ppNote.style.display = method==="paypal"   ? "" : "none";
  if (mmNote) mmNote.style.display = method==="metamask" ? "" : "none";
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById("paypalToast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 4000);
}

// ── Shop open/close ────────────────────────────────────────────────────────
function openShop() {
  const overlay = document.getElementById("shopOverlay");
  if (overlay) overlay.classList.add("open");
  buildCoinGrid();
  buildItemGrid();
  const user = getUser();
  refreshCoinDisplay(user ? (user.coins || 0) : 0);
}
function closeShop() {
  const overlay = document.getElementById("shopOverlay");
  if (overlay) overlay.classList.remove("open");
}

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll(".shop-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".shop-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    const pane = document.getElementById(`tab-${tab.dataset.tab}`);
    if (pane) pane.classList.add("active");
  });
});

document.querySelectorAll(".pay-method-btn").forEach(btn =>
  btn.addEventListener("click", () => setPaymentMethod(btn.dataset.method)));

["openShop","openShopMenu","openShopPause"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", openShop);
});

const closeBtn = document.getElementById("closeShop");
if (closeBtn) closeBtn.addEventListener("click", closeShop);

const shopOverlay = document.getElementById("shopOverlay");
if (shopOverlay) {
  shopOverlay.addEventListener("click", e => { if (e.target===e.currentTarget) closeShop(); });
}
document.addEventListener("keydown", e => { if (e.key==="Escape") closeShop(); });
