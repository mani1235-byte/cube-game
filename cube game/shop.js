// shop.js
// DEPENDS ON: script.js (must load after it)
// Shop UI, PayPal + MetaMask integration
// ============================================================================

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  CONFIGURATION — fill in your details here before going live            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

const CONFIG = {
  // Your PayPal business email (money lands here)
  paypalEmail: "alferedobook@gmail.com",
  paypalCurrency: "USD",

  // Your MetaMask wallet address (ETH sent directly here)
  metamaskAddress: "0x6D08AcBc3910c8eC7A45D8Df8796aEEcfe7A70Bb",

  // ETH prices per coin pack (set based on current ETH price)
  // Example: if ETH = $2000, then $1.99 ≈ 0.001 ETH
  ethPrices: {
    "200":  "0.001",   // ~$1.99 worth of ETH
    "600":  "0.0025",  // ~$4.99 worth of ETH
    "1500": "0.005",   // ~$9.99 worth of ETH
    "4000": "0.01",    // ~$19.99 worth of ETH
  }
};

// ── Payment method state ───────────────────────────────────────────────────
let selectedPayment = "paypal"; // "paypal" or "metamask"

// ── PayPal checkout ────────────────────────────────────────────────────────
function buyWithPayPal(itemName, price) {
  const params = new URLSearchParams({
    cmd:           "_xclick",
    business:      CONFIG.paypalEmail,
    item_name:     itemName,
    amount:        price,
    currency_code: CONFIG.paypalCurrency,
    return:        window.location.href,
    cancel_return: window.location.href,
    no_shipping:   "1",
  });
  window.open(`https://www.paypal.com/cgi-bin/webscr?${params}`, "_blank", "noopener,noreferrer");
  showToast("🔵 Redirecting to PayPal…");
}

// ── MetaMask / ETH direct payment ─────────────────────────────────────────
async function buyWithMetaMask(itemName, coins, ethAmount) {
  // 1. Check MetaMask is installed
  if (typeof window.ethereum === "undefined") {
    showToast("❌ MetaMask not found — install it first!");
    window.open("https://metamask.io/download/", "_blank", "noopener,noreferrer");
    return;
  }

  try {
    showToast("🦊 Connecting to MetaMask…");

    // 2. Request wallet access
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const from = accounts[0];

    // 3. Convert ETH amount to wei (hex)
    const ethInWei = BigInt(Math.round(parseFloat(ethAmount) * 1e18));
    const valueHex = "0x" + ethInWei.toString(16);

    // 4. Send ETH directly to your MetaMask address
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from,
        to:    CONFIG.metamaskAddress,
        value: valueHex,
        gas:   "0x5208", // 21000 — standard ETH transfer
      }],
    });

    showToast(`✅ Payment sent! TX: ${txHash.slice(0, 14)}…`);
    console.log(`MetaMask TX for ${itemName}:`, txHash);

  } catch (err) {
    if (err.code === 4001) {
      showToast("❌ Transaction cancelled.");
    } else {
      showToast("❌ Error: " + (err.message || "Unknown error"));
      console.error(err);
    }
  }
}

// ── Unified buy handler ────────────────────────────────────────────────────
function handleBuy(itemName, price, coins) {
  if (selectedPayment === "metamask") {
    const ethAmount = CONFIG.ethPrices[String(coins)] || "0.001";
    buyWithMetaMask(itemName, coins, ethAmount);
  } else {
    buyWithPayPal(itemName, price);
  }
}

// ── Payment method selector ────────────────────────────────────────────────
function setPaymentMethod(method) {
  selectedPayment = method;
  document.querySelectorAll(".pay-method-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.method === method);
  });
  document.querySelectorAll(".coin-card").forEach(card => {
    const usdEl = card.querySelector(".coin-price-usd");
    const ethEl = card.querySelector(".coin-price-eth");
    if (!usdEl || !ethEl) return;
    usdEl.style.display = method === "paypal"   ? "" : "none";
    ethEl.style.display = method === "metamask" ? "" : "none";
  });
  const ppNote  = document.getElementById("paypalNote");
  const mmNote  = document.getElementById("metamaskNote");
  if (ppNote)  ppNote.style.display  = method === "paypal"   ? "" : "none";
  if (mmNote)  mmNote.style.display  = method === "metamask" ? "" : "none";
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast = document.getElementById("paypalToast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ── Shop open / close ──────────────────────────────────────────────────────
function openShop()  { document.getElementById("shopOverlay").classList.add("open"); }
function closeShop() { document.getElementById("shopOverlay").classList.remove("open"); }

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll(".shop-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".shop-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".shop-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Payment method buttons ─────────────────────────────────────────────────
document.querySelectorAll(".pay-method-btn").forEach(btn => {
  btn.addEventListener("click", () => setPaymentMethod(btn.dataset.method));
});

// ── Wire open triggers ─────────────────────────────────────────────────────
["openShop", "openShopMenu", "openShopPause"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", openShop);
});

// ── Wire close triggers ────────────────────────────────────────────────────
document.getElementById("closeShop").addEventListener("click", closeShop);
document.getElementById("shopOverlay").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeShop();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeShop(); });

// ── Item unlock buttons ────────────────────────────────────────────────────
document.querySelectorAll(".item-buy").forEach(btn => {
  btn.addEventListener("click", () => showToast("Feature coming soon! Buy coins first 🪙"));
});
