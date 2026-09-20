// translate.js — CUBE GAME i18n
// Provides: getLang(), t(text), translatePage()

function getLang() {
  return localStorage.getItem("cg_lang") || navigator.language.slice(0, 2) || "en";
}

// In-memory cache: { lang: { originalText: translatedText } }
const _tCache = {};

// Translate a single string — returns a Promise<string>
// Used by JS files for dynamic strings: el.textContent = await t("Game Over");
async function t(text) {
  const lang = getLang();
  if (lang === "en") return text;
  if (!_tCache[lang]) _tCache[lang] = {};
  if (_tCache[lang][text] !== undefined) return _tCache[lang][text];
  try {
    const res = await fetch(
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
      lang + "&dt=t&q=" + encodeURIComponent(text)
    );
    const data = await res.json();
    const result = data[0][0][0];
    _tCache[lang][text] = result;
    return result;
  } catch {
    return text;
  }
}

async function translateTextBatch(texts, lang) {
  if (!_tCache[lang]) _tCache[lang] = {};

  // Deduplicate and filter already-cached
  const unique = [...new Set(texts)].filter(tx => _tCache[lang][tx] === undefined);

  const CHUNK = 20;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    try {
      const q = chunk.map(tx => "q=" + encodeURIComponent(tx)).join("&");
      const res = await fetch(
        "https://translate.googleapis.com/translate_a/t?client=gtx&sl=auto&tl=" + lang + "&" + q
      );
      const data = await res.json();
      const translations = Array.isArray(data[0]) ? data.map(d => d[0]) : data;
      chunk.forEach((orig, idx) => {
        _tCache[lang][orig] = translations[idx] || orig;
      });
    } catch {
      chunk.forEach(orig => { _tCache[lang][orig] = orig; });
    }
  }

  return texts.map(tx => _tCache[lang][tx] || tx);
}

async function translatePage() {
  const lang = getLang();
  document.documentElement.lang = lang;
  if (lang === "en") return;

  const nodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "CODE" || tag === "PRE") {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest("[data-notranslate]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue.trim();
    if (text.length > 2 && !/^\d+$/.test(text)) {
      nodes.push({ node, text });
    }
  }

  if (!nodes.length) return;

  const texts = nodes.map(n => n.text);
  const translated = await translateTextBatch(texts, lang);

  nodes.forEach((n, i) => {
    n.node.nodeValue = translated[i];
  });
}

window.addEventListener("load", translatePage);
