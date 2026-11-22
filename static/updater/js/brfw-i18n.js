/*!
 * brfw-i18n.js — 共用多语言运行时（更新工具 + 手柄检测共用）
 * 文案表在根目录 i18n.js（由 tools/common/brfw_i18n.py 生成）
 * 许可：Apache License 2.0
 */
window.BRFWI18N = (function () {
  "use strict";

  var S = window.BRFW_STRINGS || {};
  var LANGS = window.BRFW_LANGS || ["zh-CN", "zh-TW", "en"];
  var LABELS = window.BRFW_LANG_NAMES || {};
  var STORE = "brfw.lang";
  var lang = "en";

  function available() { return LANGS.filter(function (l) { return !!S[l]; }); }

  function detect() {
    var q = null;
    try { q = new URLSearchParams(location.search).get("lang"); } catch (e) { q = null; }
    if (q && S[q]) return q;
    try { var saved = localStorage.getItem(STORE); if (saved && S[saved]) return saved; } catch (e) { /* ignore */ }
    /* JZW: 默认英文 —— 不跟随浏览器语言；?lang= 与用户手动选择仍然优先 */
    return "en";
  }

  function t(key, vars) {
    var table = S[lang] || {};
    var s = table[key] || (S["en"] && S["en"][key]) || (S["zh-CN"] && S["zh-CN"][key]) || key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return (vars[k] === undefined || vars[k] === null) ? m : String(vars[k]);
      });
    }
    return s;
  }

  function set(l) {
    if (!S[l]) return;
    lang = l;
    try { localStorage.setItem(STORE, l); } catch (e) { /* ignore */ }
  }

  /** 填充所有 [data-i18n] / [data-i18n-title] */
  function applyStatic(rootEl) {
    var scope = rootEl || document;
    var nodes = scope.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    var titles = scope.querySelectorAll("[data-i18n-title]");
    for (var j = 0; j < titles.length; j++) titles[j].title = t(titles[j].getAttribute("data-i18n-title"));
    document.documentElement.lang = lang;
  }

  /** 填充语言下拉并绑定切换 */
  function mountSelect(sel, onChange) {
    if (!sel) return;
    sel.innerHTML = "";
    available().forEach(function (l) {
      var o = document.createElement("option");
      o.value = l;
      o.textContent = LABELS[l] || l;
      sel.appendChild(o);
    });
    sel.value = lang;
    sel.title = t("adv_lang");
    sel.addEventListener("change", function () {
      set(sel.value);
      applyStatic();
      sel.title = t("adv_lang");
      if (onChange) onChange();
    });
  }

  lang = detect();

  return {
    t: t, set: set, detect: detect, applyStatic: applyStatic, mountSelect: mountSelect,
    available: available, labels: LABELS,
    get lang() { return lang; }
  };
})();
