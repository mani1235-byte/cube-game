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
  },
  getActiveSkinColors() {
    try {
      const user = getUser();
      if (!user || !user.equippedSkin) return null;
      if (!isItemUnlocked(user.equippedSkin)) return null;
      const item = ITEM_CATALOGUE.find(i => i.id === user.equippedSkin);
      if (!item) return null;
      return parseGradientColors(item.gradient);
    } catch (_) {}
    return null;
  },
  equipSkin(id) {
    const user = getUser();
    if (!user) return;
    user.equippedSkin = id;
    saveUser(user);
  },
  getEquippedBadgeDef() {
    try {
      const user = getUser();
      if (!user || !user.equippedBadge) return null;
      if (!isItemUnlocked(user.equippedBadge)) return null;
      return ITEM_CATALOGUE.find(i => i.id === user.equippedBadge) || null;
    } catch (_) {}
    return null;
  },
  equipBadge(id) {
    const user = getUser();
    if (!user) return;
    user.equippedBadge = id;
    const item = ITEM_CATALOGUE.find(i => i.id === id);
    user.equippedBadgeIcon = item ? item.icon : null;
    saveUser(user);
  }
};

// Parse a "135deg,#7b2fff,#fa2473"-style gradient string into two {r,g,b} colors.
// Reused for both the shop preview card AND the actual in-game skin tint, so
// every skin's gameplay color always matches what the player saw in the shop.
function parseGradientColors(gradientStr) {
  if (!gradientStr) return null;
  const hexes = gradientStr.match(/#[0-9a-fA-F]{6}/g);
  if (!hexes || hexes.length < 2) return null;
  return hexes.slice(0, 2).map(hex => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }));
}

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
    // Auto-equip the first trail/skin/badge purchased so the purchase has an
    // immediate, visible payoff instead of sitting unused until manually equipped.
    if (itemId.startsWith("trail_") && !user.equippedTrail) user.equippedTrail = itemId;
    if (itemId.startsWith("skin_")  && !user.equippedSkin)  user.equippedSkin  = itemId;
    if (itemId.startsWith("badge_") && !user.equippedBadge) {
      user.equippedBadge = itemId;
      const it = ITEM_CATALOGUE.find(i => i.id === itemId);
      user.equippedBadgeIcon = it ? it.icon : null;
    }
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
  // Update equip buttons (trails, skins, badges)
  document.querySelectorAll(".item-equip[data-item-id]").forEach(btn => {
    const id = btn.dataset.itemId;
    const user = getUser();
    const item = ITEM_CATALOGUE.find(i => i.id === id);
    const field = !item ? null : item.tag === "trail" ? "equippedTrail" : item.tag === "skin" ? "equippedSkin" : "equippedBadge";
    const isEquipped = !!(field && user && user[field] === id);
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
  const user = getUser();
  tags.forEach(section => {
    const items = ITEM_CATALOGUE.filter(i => i.tag === section.key);
    if (!items.length) return;
    html += `<div class="item-section-label">${section.label}</div><div class="item-grid">`;
    items.forEach(item => {
      const owned       = isItemUnlocked(item.id);
      const isTrail     = item.tag === "trail";
      const isSkin      = item.tag === "skin";
      const isBadge     = item.tag === "badge";
      const equippable  = isTrail || isSkin || isBadge;
      const equipField  = isTrail ? "equippedTrail" : isSkin ? "equippedSkin" : "equippedBadge";
      const equipFn     = isTrail ? "equipTrail" : isSkin ? "equipSkin" : "equipBadge";
      const isEquipped  = equippable && user && user[equipField] === item.id;
      const isExclusive = item.cost === Infinity; // earned via Trophy Road / Brawl Pass, not buyable

      const costHtml = isExclusive
        ? `<div class="item-cost">🏆 EXCLUSIVE</div>`
        : `<div class="item-cost">🪙 ${item.cost.toLocaleString()}</div>`;

      let buyBtnHtml = "";
      if (isExclusive) {
        if (!owned) buyBtnHtml = `<button class="buy-btn" disabled style="opacity:0.45;cursor:default">🔒 EARN IT</button>`;
      } else {
        buyBtnHtml = `<button class="buy-btn item-buy" data-item-id="${item.id}" onclick="buyItem('${item.id}')"
            ${owned ? 'disabled style="opacity:0.6;cursor:default"' : ""}>
            ${owned ? "✅ OWNED" : "UNLOCK"}
          </button>`;
      }

      html += `
        <div class="item-card${owned ? " item-owned" : ""}">
          <div class="item-preview" style="background:linear-gradient(${item.gradient})">${item.icon}</div>
          <div class="item-name">${item.name}</div>
          <div class="item-desc">${item.desc}</div>
          ${costHtml}
          ${buyBtnHtml}
          ${owned && equippable ? `<button class="buy-btn item-equip" data-item-id="${item.id}"
            onclick="${equipFn}('${item.id}')"
            style="${isEquipped ? "background:rgba(166,224,44,0.3);border-color:#a6e02c;" : ""}margin-top:4px;font-size:0.6rem;">
            ${isEquipped ? "✓ EQUIPPED" : "EQUIP"}
          </button>` : ""}
        </div>`;
    });
    html += "</div>";
  });
  grid.innerHTML = html;
}

function equipSkin(id) {
  const user = getUser();
  if (!user) return;
  user.equippedSkin = id;
  saveUser(user);
  showToast(`✅ Skin equipped! Active in next game.`);
  buildItemGrid();
}

function equipBadge(id) {
  const user = getUser();
  if (!user) return;
  user.equippedBadge = id;
  const item = ITEM_CATALOGUE.find(i => i.id === id);
  user.equippedBadgeIcon = item ? item.icon : null;
  saveUser(user);
  showToast(`✅ Badge equipped!`);
  buildItemGrid();
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

// ── Brawl Stars-style Purchase Success Screen ────────────────────────────
function showCoinCelebration(amount, label) {
  // Inject styles once
  if (!document.getElementById("purchaseSuccessStyle")) {
    const s = document.createElement("style");
    s.id = "purchaseSuccessStyle";
    s.textContent = `
      .purchase-overlay {
        position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);
        animation:purchaseFadeIn .25s ease;
      }
      @keyframes purchaseFadeIn{from{opacity:0}to{opacity:1}}
      .purchase-card {
        background:linear-gradient(160deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);
        border:2px solid rgba(255,215,0,0.45);
        border-radius:24px;
        padding:36px 40px 28px;
        text-align:center;
        width:min(420px,90vw);
        box-shadow:0 0 60px rgba(255,215,0,0.18),0 20px 60px rgba(0,0,0,0.6);
        animation:purchaseCardPop .4s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes purchaseCardPop{from{transform:scale(0.5) translateY(40px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
      .purchase-banner {
        font-size:0.65rem;letter-spacing:0.18em;color:rgba(255,215,0,0.7);
        text-transform:uppercase;font-weight:bold;font-family:monospace;margin-bottom:16px;
      }
      .purchase-icon-wrap {
        position:relative;display:inline-block;margin-bottom:12px;
      }
      .purchase-icon {
        font-size:clamp(56px,14vw,88px);
        filter:drop-shadow(0 0 24px rgba(255,215,0,0.7));
        animation:purchaseIconFloat 2s ease-in-out infinite;
      }
      @keyframes purchaseIconFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
      .purchase-checkmark {
        position:absolute;bottom:-4px;right:-4px;
        background:#a6e02c;border-radius:50%;width:28px;height:28px;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;border:2px solid #1a1a2e;
        animation:purchaseCheckPop .35s .3s cubic-bezier(0.34,1.56,0.64,1) both;
      }
      @keyframes purchaseCheckPop{from{transform:scale(0)}to{transform:scale(1)}}
      .purchase-amount {
        font-size:clamp(28px,7vw,44px);font-weight:900;color:#ffd700;
        font-family:monospace;letter-spacing:0.05em;
        text-shadow:0 0 20px rgba(255,215,0,0.5);
        margin-bottom:6px;
      }
      .purchase-sublabel {
        font-size:0.75rem;color:rgba(255,255,255,0.5);font-family:monospace;
        letter-spacing:0.08em;margin-bottom:24px;
      }
      .purchase-balance {
        background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
        border-radius:12px;padding:10px 20px;margin-bottom:24px;
        font-family:monospace;font-size:0.82rem;color:rgba(255,255,255,0.6);
        display:flex;align-items:center;justify-content:center;gap:8px;
      }
      .purchase-balance b { color:#ffd700; font-size:1rem; }
      .purchase-ok-btn {
        background:linear-gradient(135deg,#ffd700,#ff9900);
        border:none;border-radius:14px;padding:14px 48px;
        font-family:monospace;font-weight:900;font-size:1rem;
        letter-spacing:0.08em;color:#1a0a00;cursor:pointer;
        box-shadow:0 0 20px rgba(255,180,0,0.4);
        transition:transform .15s,box-shadow .15s;
        width:100%;
      }
      .purchase-ok-btn:hover{transform:scale(1.03);box-shadow:0 0 30px rgba(255,200,0,0.6);}
      .purchase-ok-btn:active{transform:scale(0.97);}
      .purchase-sparks {
        position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:24px;
      }
      .purchase-spark {
        position:absolute;width:6px;height:6px;border-radius:50%;
        animation:sparkFloat 1.2s ease-out forwards;
      }
      @keyframes sparkFloat{
        0%{transform:translateY(0) scale(1);opacity:1}
        100%{transform:translateY(-120px) scale(0);opacity:0}
      }
    `;
    document.head.appendChild(s);
  }

  const user = typeof getUser === "function" ? getUser() : null;
  const balance = user ? (user.coins || 0) : 0;
  const displayLabel = label || `+${amount.toLocaleString()} Coins`;
  const isPass = !amount; // season pass purchase

  const overlay = document.createElement("div");
  overlay.className = "purchase-overlay";

  // Sparkles
  const sparksHtml = Array.from({length:12}, (_,i) => {
    const colors = ["#ffd700","#ff9900","#a6e02c","#67d7f0","#fa2473"];
    const color = colors[i % colors.length];
    const left = 10 + (i / 11) * 80;
    const delay = (i * 0.08).toFixed(2);
    return `<div class="purchase-spark" style="left:${left}%;bottom:20%;background:${color};animation-delay:${delay}s;animation-duration:${0.9+Math.random()*0.5}s"></div>`;
  }).join("");

  overlay.innerHTML = `
    <div class="purchase-card" style="position:relative">
      <div class="purchase-sparks">${sparksHtml}</div>
      <div class="purchase-banner">✅ Purchase Successful</div>
      <div class="purchase-icon-wrap">
        <div class="purchase-icon">${isPass ? "⭐" : "🪙"}</div>
        <div class="purchase-checkmark">✓</div>
      </div>
      <div class="purchase-amount">${isPass ? "PREMIUM PASS" : "+" + amount.toLocaleString()}</div>
      <div class="purchase-sublabel">${isPass ? "Season Pass — all tiers unlocked!" : displayLabel}</div>
      ${!isPass ? `<div class="purchase-balance">Your balance: <b>🪙 ${balance.toLocaleString()}</b></div>` : ""}
      <button class="purchase-ok-btn" id="purchaseOkBtn">AWESOME! 🎉</button>
    </div>`;

  document.body.appendChild(overlay);

  const closeOverlay = () => {
    overlay.style.animation = "purchaseFadeIn .2s ease reverse";
    setTimeout(() => overlay.remove(), 200);
  };
  overlay.querySelector("#purchaseOkBtn").addEventListener("click", closeOverlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeOverlay(); });
  setTimeout(closeOverlay, 7000);
}

// Legacy alias
function showPurchaseSuccess(label) {
  showCoinCelebration(0, label);
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
