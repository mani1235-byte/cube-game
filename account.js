// account.js
// One tiny shared helper: a stable key that identifies whichever account is
// currently signed in (or "anon" if nobody is). Used to namespace
// per-account localStorage data (progression, high score, etc.) so that
// logging out and signing into a DIFFERENT account never shows the
// previous account's coins/trophies/XP/score — everything starts at 0 for
// an account that hasn't played yet, exactly like a fresh install.
//
// Load this BEFORE script.js / progression/save-system.js.
window.CGAccount = (function () {
  function currentKey() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem("cg_current_user")); } catch (_) {}
    if (!user) return "anon";
    if (user.uid)      return "uid:" + user.uid;
    if (user.email)    return "email:" + String(user.email).toLowerCase();
    if (user.username) return "guest:" + String(user.username).toLowerCase();
    return "anon";
  }
  return { currentKey };
})();
