// ads.js — CUBE GAME Ad System
// DEPENDS ON: script.js, mechanics.js (load after both)
// Google AdSense rewarded ads — connect real Ad Unit ID after launch
// Ads show: after game over, after losing a heart, every 5 minutes
// Reward: +1 heart OR +50 coins for watching
// ============================================================================

(function () {
  "use strict";

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  CONFIG — fill in after Google AdSense approves firstgame.org       ║
  // ╚══════════════════════════════════════════════════════════════════════╝
  const CONFIG = {
    adUnitId:    "ca-pub-XXXXXXXXXXXXXXXX", // ← your Google AdSense publisher ID
    adSlotId:    "XXXXXXXXXX",              // ← your Ad Unit slot ID
    rewardCoins: 50,
    adInterval:  5 * 60 * 1000,            // 5 minutes in ms
  };

  // ── State ──────────────────────────────────────────────────────────────
  let adShowing      = false;
  let lastAdTime     = Date.now();
  let adAvailable    = true; // set to false until real AdSense loads
  let intervalTimer  = null;
  let adContext      = null; // "gameover" | "heart" | "interval"
  let fakeAdTimer    = null;
  let fakeAdSeconds  = 30;

  // ═══════════════════════════════════════════════════════════════════════
  //  STYLES
  // ═══════════════════════════════════════════════════════════════════════
  const style = document.createElement("style");
  style.textContent = `
    #adOverlay {
      position: fixed;
      inset: 0;
      z-index: 99000;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.92);
      font-family: 'Share Tech Mono', monospace;
      text-align: center;
      gap: 16px;
      animation: adFadeIn 0.3s ease;
    }
    @keyframes adFadeIn { from { opacity:0; } to { opacity:1; } }
    #adOverlay.show { display: flex; }

    #adBox {
      width: min(480px, 90vw);
      background: linear-gradient(160deg, #112233, #0a1820);
      border: 1px solid rgba(103,215,240,0.2);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    }

    #adHeader {
      padding: 16px 20px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #adHeaderTitle {
      font-size: 0.75rem;
      letter-spacing: 0.12em;
      color: rgba(255,255,255,0.4);
    }
    #adCountdown {
      font-size: 0.75rem;
      color: #67d7f0;
      letter-spacing: 0.08em;
      min-width: 60px;
      text-align: right;
    }

    #adContent {
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      position: relative;
      overflow: hidden;
    }

    /* Fake ad placeholder — replaced by real AdSense after launch */
    #fakeAd {
      width: 100%;
      height: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
    }
    #fakeAdProgress {
      width: 80%;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    #fakeAdProgressFill {
      height: 100%;
      background: linear-gradient(90deg, #67d7f0, #a6e02c);
      width: 0%;
      transition: width 1s linear;
      box-shadow: 0 0 8px rgba(103,215,240,0.5);
    }
    #fakeAdText {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.3);
      letter-spacing: 0.08em;
    }

    /* Real AdSense container */
    #realAdContainer {
      display: none;
      width: 100%;
    }
    .adsbygoogle-container {
      display: block;
      width: 100%;
    }

    #adReward {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-top: 1px solid rgba(255,255,255,0.07);
      flex-wrap: wrap;
    }
    .reward-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .reward-icon { font-size: 1.6rem; }
    .reward-label {
      font-size: 0.62rem;
      color: rgba(255,255,255,0.4);
      letter-spacing: 0.08em;
    }
    .reward-divider {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.2);
    }

    #adFooter {
      padding: 14px 20px;
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    }

    #adSkipBtn {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 8px;
      color: rgba(255,255,255,0.35);
      font-family: monospace;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      cursor: not-allowed;
      transition: all 0.2s;
    }
    #adSkipBtn.ready {
      color: rgba(255,255,255,0.6);
      border-color: rgba(255,255,255,0.25);
      cursor: pointer;
    }
    #adSkipBtn.ready:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.5);
    }

    #adClaimBtn {
      padding: 10px 24px;
      background: linear-gradient(135deg, rgba(103,215,240,0.25), rgba(166,224,44,0.2));
      border: 1px solid rgba(103,215,240,0.4);
      border-radius: 8px;
      color: rgba(255,255,255,0.4);
      font-family: monospace;
      font-size: 0.85rem;
      font-weight: bold;
      letter-spacing: 0.1em;
      cursor: not-allowed;
      transition: all 0.2s;
    }
    #adClaimBtn.ready {
      color: #fff;
      cursor: pointer;
      border-color: rgba(103,215,240,0.7);
    }
    #adClaimBtn.ready:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(103,215,240,0.3);
    }

    /* No thanks / pay to skip */
    #adNoThanks {
      width: 100%;
      text-align: center;
      padding: 0 20px 16px;
    }
    #adNoThanks button {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.2);
      font-family: monospace;
      font-size: 0.68rem;
      letter-spacing: 0.06em;
      cursor: pointer;
      transition: color 0.2s;
      padding: 4px 8px;
    }
    #adNoThanks button:hover { color: rgba(255,255,255,0.5); }

    /* Toast */
    #adToast {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%) translateY(10px);
      background: linear-gradient(135deg, #1e3a4a, #0f2230);
      border: 1px solid rgba(103,215,240,0.4);
      border-radius: 10px;
      padding: 10px 20px;
      font-family: monospace;
      font-size: 0.82rem;
      color: #67d7f0;
      letter-spacing: 0.06em;
      z-index: 100000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s;
      white-space: nowrap;
    }
    #adToast.show {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    /* 5-min ad prompt */
    #adPrompt {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: linear-gradient(135deg, #112233, #0a1820);
      border: 1px solid rgba(254,149,34,0.35);
      border-radius: 12px;
      padding: 12px 20px;
      display: none;
      align-items: center;
      gap: 12px;
      font-family: monospace;
      font-size: 0.78rem;
      color: rgba(255,255,255,0.7);
      letter-spacing: 0.05em;
      z-index: 9000;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
      animation: promptIn 0.4s cubic-bezier(0.16,1,0.3,1) both;
    }
    @keyframes promptIn {
      from { opacity:0; transform: translateX(-50%) translateY(20px); }
      to   { opacity:1; transform: translateX(-50%) translateY(0); }
    }
    #adPrompt.show { display: flex; }
    #adPromptWatch {
      padding: 7px 14px;
      background: rgba(254,149,34,0.2);
      border: 1px solid rgba(254,149,34,0.5);
      border-radius: 7px;
      color: #fe9522;
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: bold;
      cursor: pointer;
      letter-spacing: 0.06em;
      white-space: nowrap;
      transition: all 0.2s;
    }
    #adPromptWatch:hover { background: rgba(254,149,34,0.35); }
    #adPromptClose {
      color: rgba(255,255,255,0.3);
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.9rem;
      padding: 0 4px;
    }
  `;
  document.head.appendChild(style);

  // ═══════════════════════════════════════════════════════════════════════
  //  BUILD DOM
  // ═══════════════════════════════════════════════════════════════════════

  document.body.insertAdjacentHTML("beforeend", `
    <!-- Main ad overlay -->
    <div id="adOverlay">
      <div id="adBox">
        <div id="adHeader">
          <span id="adHeaderTitle">📺 ADVERTISEMENT</span>
          <span id="adCountdown">⏱ 0:30</span>
        </div>
        <div id="adContent">
          <!-- Fake ad shown until real AdSense loads -->
          <div id="fakeAd">
            <div style="font-size:2rem">🎮</div>
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.5);letter-spacing:0.1em">AD PLAYING...</div>
            <div id="fakeAdProgress"><div id="fakeAdProgressFill"></div></div>
            <div id="fakeAdText">Watch to earn your reward</div>
          </div>
          <!-- Real AdSense goes here after launch -->
          <div id="realAdContainer">
            <ins class="adsbygoogle adsbygoogle-container"
              data-ad-client="${CONFIG.adUnitId}"
              data-ad-slot="${CONFIG.adSlotId}"
              data-ad-format="auto"
              data-full-width-responsive="true">
            </ins>
          </div>
        </div>
        <div id="adReward">
          <div class="reward-badge">
            <span class="reward-icon">❤️</span>
            <span class="reward-label">+1 LIFE</span>
          </div>
          <span class="reward-divider">+</span>
          <div class="reward-badge">
            <span class="reward-icon">🪙</span>
            <span class="reward-label">+50 COINS</span>
          </div>
        </div>
        <div id="adFooter">
          <button id="adSkipBtn">SKIP (30s)</button>
          <button id="adClaimBtn">🎁 CLAIM REWARD</button>
        </div>
        <div id="adNoThanks">
          <button id="adNoThanksBtn">No thanks, continue without reward</button>
        </div>
      </div>
    </div>

    <!-- 5-min interval prompt -->
    <div id="adPrompt">
      🎁 Watch a short ad for <strong style="color:#fe9522">+50 coins!</strong>
      <button id="adPromptWatch">WATCH AD</button>
      <button id="adPromptClose">✕</button>
    </div>

    <!-- Toast -->
    <div id="adToast"></div>
  `);

  // ═══════════════════════════════════════════════════════════════════════
  //  AD LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  function showAd(context) {
    if (adShowing) return;
    adContext  = context;
    adShowing  = true;
    fakeAdSeconds = 30;

    const overlay   = document.getElementById("adOverlay");
    const skipBtn   = document.getElementById("adSkipBtn");
    const claimBtn  = document.getElementById("adClaimBtn");
    const countdown = document.getElementById("adCountdown");
    const fill      = document.getElementById("fakeAdProgressFill");

    overlay.classList.add("show");
    skipBtn.classList.remove("ready");
    claimBtn.classList.remove("ready");
    skipBtn.textContent  = `SKIP (${fakeAdSeconds}s)`;
    claimBtn.textContent = "🎁 CLAIM REWARD";
    fill.style.width     = "0%";

    // Start countdown
    fakeAdTimer = setInterval(() => {
      fakeAdSeconds--;
      fill.style.width   = `${((30 - fakeAdSeconds) / 30) * 100}%`;
      countdown.textContent = `⏱ 0:${fakeAdSeconds.toString().padStart(2, "0")}`;

      if (fakeAdSeconds <= 10) {
        skipBtn.textContent = `SKIP (${fakeAdSeconds}s)`;
      }

      if (fakeAdSeconds <= 0) {
        clearInterval(fakeAdTimer);
        skipBtn.classList.add("ready");
        skipBtn.textContent  = "SKIP";
        claimBtn.classList.add("ready");
        claimBtn.textContent = "🎁 CLAIM REWARD";
        countdown.textContent = "✅ DONE!";
        fill.style.width = "100%";
      }
    }, 1000);

    lastAdTime = Date.now();
  }

  function closeAd(claimed) {
    clearInterval(fakeAdTimer);
    const overlay = document.getElementById("adOverlay");
    overlay.classList.remove("show");
    adShowing = false;

    if (claimed) {
      giveReward();
    }
  }

  function giveReward() {
    // +1 heart via mechanics.js gainHeart if available
    if (typeof gainHeart === "function") gainHeart();

    // +50 coins
    try {
      const key  = "cg_current_user";
      const user = JSON.parse(localStorage.getItem(key));
      if (user) {
        user.coins = (user.coins || 0) + CONFIG.rewardCoins;
        localStorage.setItem(key, JSON.stringify(user));
        const users = JSON.parse(localStorage.getItem("cg_users") || "{}");
        if (users[user.username?.toLowerCase()]) {
          users[user.username.toLowerCase()].coins = user.coins;
          localStorage.setItem("cg_users", JSON.stringify(users));
        }
      }
    } catch(e) {}

    showToast(`🎁 +1 Life & +${CONFIG.rewardCoins} Coins!`);
  }

  function showToast(msg) {
    const toast = document.getElementById("adToast");
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  // ── Buttons ────────────────────────────────────────────────────────────
  document.getElementById("adSkipBtn").addEventListener("click", () => {
    if (!document.getElementById("adSkipBtn").classList.contains("ready")) return;
    closeAd(false);
  });

  document.getElementById("adClaimBtn").addEventListener("click", () => {
    if (!document.getElementById("adClaimBtn").classList.contains("ready")) return;
    closeAd(true);
  });

  document.getElementById("adNoThanksBtn").addEventListener("click", () => {
    clearInterval(fakeAdTimer);
    closeAd(false);
  });

  // ── 5-min interval prompt ──────────────────────────────────────────────
  document.getElementById("adPromptWatch").addEventListener("click", () => {
    document.getElementById("adPrompt").classList.remove("show");
    showAd("interval");
  });

  document.getElementById("adPromptClose").addEventListener("click", () => {
    document.getElementById("adPrompt").classList.remove("show");
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  TRIGGERS — patch endGame & loseHeart
  // ═══════════════════════════════════════════════════════════════════════

  // After game over
  const _originalEndGame = endGame;
  window.endGame = function() {
    _originalEndGame();
    setTimeout(() => showAd("gameover"), 800);
  };

  // After losing a heart — patch loseHeart from mechanics.js
  const _mechanicsLoseHeart = typeof loseHeart !== "undefined" ? loseHeart : null;
  if (_mechanicsLoseHeart) {
    window.loseHeart = function() {
      _mechanicsLoseHeart();
      // Show ad after small delay only if still in game
      setTimeout(() => {
        if (isInGame() && !adShowing) showAd("heart");
      }, 600);
    };
  }

  // ── 5-min interval check ───────────────────────────────────────────────
  intervalTimer = setInterval(() => {
    if (!isInGame() || adShowing) return;
    const elapsed = Date.now() - lastAdTime;
    if (elapsed >= CONFIG.adInterval) {
      document.getElementById("adPrompt").classList.add("show");
      // Auto-hide prompt after 8 seconds
      setTimeout(() => {
        document.getElementById("adPrompt").classList.remove("show");
      }, 8000);
    }
  }, 10000); // check every 10 seconds

  // ═══════════════════════════════════════════════════════════════════════
  //  REAL ADSENSE LOADER
  //  Uncomment after firstgame.org is approved by Google AdSense
  // ═══════════════════════════════════════════════════════════════════════
  /*
  function loadRealAds() {
    const script = document.createElement("script");
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.adUnitId}`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      // Hide fake ad, show real one
      document.getElementById("fakeAd").style.display = "none";
      document.getElementById("realAdContainer").style.display = "block";
      (adsbygoogle = window.adsbygoogle || []).push({});
      adAvailable = true;
    };
    document.head.appendChild(script);
  }
  loadRealAds();
  */

  console.log("📺 Ad system loaded — fake ads active, connect AdSense after launch!");

})();