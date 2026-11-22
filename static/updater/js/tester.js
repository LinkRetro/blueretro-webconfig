/*!
 * tester.js — LinkRetro 手柄检测 / Original Xbox 手柄可视化
 *
 * 映射依据（本仓库固件源码）：
 *   ESP32(BlueRetro) 输出标准布局 -> 13 字节 PadIn -I2C-> RP2040
 *   RP2040 的 XboxOG_GP.cpp 做「同名直通」：A→A B→B X→X Y→Y，LB→White，RB→Black
 *   浏览器 Gamepad API 的 standard 布局与 Bluepad32 标准布局一致，
 *   因此默认映射为「位置一一对应」，本页直接用按钮下标映射。
 *
 * 基于开源项目 BlueRetro（作者 darthcloud，Apache License 2.0）
 * 许可：Apache License 2.0
 */
(function () {
  "use strict";

  var I = window.BRFWI18N;
  var t = function (k, v) { return I.t(k, v); };
  function $(id) { return document.getElementById(id); }

  /* 参考死区：用于提示"漂移是否偏大"，非固件实际阈值 */
  var DEADZONE = 0.1;
  var STICK_R = 34;                 // 可视化半径（像素）

  /* standard 布局 -> Original Xbox 手柄 */
  var BTN = [
    { i: 0,  id: "btn-a",     key: "A" },
    { i: 1,  id: "btn-b",     key: "B" },
    { i: 2,  id: "btn-x",     key: "X" },
    { i: 3,  id: "btn-y",     key: "Y" },
    { i: 4,  id: "btn-white", key: "White" },
    { i: 5,  id: "btn-black", key: "Black" },
    { i: 8,  id: "btn-back",  key: "Back" },
    { i: 9,  id: "btn-start", key: "Start" },
    { i: 10, id: "btn-l3",    key: "L3" },
    { i: 11, id: "btn-r3",    key: "R3" }
  ];
  var DPAD = [
    { i: 12, id: "dp-up",    key: "D-Up" },
    { i: 13, id: "dp-down",  key: "D-Down" },
    { i: 14, id: "dp-left",  key: "D-Left" },
    { i: 15, id: "dp-right", key: "D-Right" }
  ];
  var TRIG_L = 6, TRIG_R = 7;
  var STICKS = { l: { x: 252, y: 168 }, r: { x: 508, y: 262 } };

  /* 来源手柄按键名（按位置对应，便于用户看懂映射） */
  var FAMILY = [
    { id: "sony",     re: /dualsense|dualshock|playstation|wireless controller|054c/i,
      lbl: { 0: "✕", 1: "○", 2: "□", 3: "△", 4: "L1", 5: "R1", 6: "L2", 7: "R2", 8: "Share", 9: "Options", 10: "L3", 11: "R3" } },
    { id: "xbox",     re: /xbox|xinput|045e/i,
      lbl: { 0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT", 8: "View", 9: "Menu", 10: "LS", 11: "RS" } },
    { id: "nintendo", re: /switch|nintendo|pro controller|joy-con|057e/i,
      lbl: { 0: "B", 1: "A", 2: "Y", 3: "X", 4: "L", 5: "R", 6: "ZL", 7: "ZR", 8: "−", 9: "+", 10: "LS", 11: "RS" } },
    { id: "generic",  re: /.*/,
      lbl: { 0: "①", 1: "②", 2: "③", 3: "④", 4: "L1", 5: "R1", 6: "L2", 7: "R2", 8: "Sel", 9: "Start", 10: "L3", 11: "R3" } }
  ];
  var SRC_POS = {
    "btn-a": [508, 243], "btn-b": [578, 173], "btn-x": [438, 173], "btn-y": [508, 106],
    "btn-white": [440, 120], "btn-black": [576, 120], "btn-back": [336, 238], "btn-start": [424, 238]
  };

  var seen = {};                 // 已按到过的按键
  var drift = { l: 0, r: 0 };    // 静止时的最大偏移
  var cur = null, curId = "", fam = FAMILY[FAMILY.length - 1], srcEls = {};
  var frames = 0, hz = 0, hzT = 0, rawT = 0;

  function allKeys() {
    return BTN.map(function (b) { return b.key; }).concat(DPAD.map(function (d) { return d.key; }));
  }

  /* ---------- 来源手柄角标 ---------- */
  function drawSrcLabels() {
    var svg = $("pad");
    if (!svg) return;
    Object.keys(SRC_POS).forEach(function (id) {
      if (srcEls[id]) { srcEls[id].remove(); delete srcEls[id]; }
    });
    BTN.forEach(function (b) {
      var pos = SRC_POS[b.id];
      if (!pos) return;
      var txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      txt.setAttribute("class", "src");
      txt.setAttribute("x", pos[0]);
      txt.setAttribute("y", pos[1]);
      txt.textContent = fam.lbl[b.i] || "";
      svg.appendChild(txt);
      srcEls[b.id] = txt;
    });
  }

  function familyOf(id) {
    for (var i = 0; i < FAMILY.length; i++) if (FAMILY[i].re.test(String(id || ""))) return FAMILY[i];
    return FAMILY[FAMILY.length - 1];
  }

  /* ---------- 状态渲染 ---------- */
  function setPressed(el, on) { if (el) el.classList.toggle("on", !!on); }

  function pickGamepad() {
    var gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < gps.length; i++) if (gps[i] && gps[i].connected) return gps[i];
    return null;
  }

  function showConnected(gp) {
    var id = gp.id || "";
    if (id !== curId) {
      curId = id;
      fam = familyOf(id);
      drawSrcLabels();
      $("dev-name").textContent = id.length > 62 ? id.slice(0, 62) + "…" : id;
      $("dev-map").textContent = gp.mapping || "—";
      $("dev-map").textContent = (gp.mapping || "—") + " / " + (gp.buttons ? gp.buttons.length : 0) + "btn " + (gp.axes ? gp.axes.length : 0) + "axis";
    }
    var empty = $("empty"), live = $("live"), pill = $("pill");
    if (empty) empty.hidden = true;
    if (live) live.hidden = false;
    if (pill) { pill.className = "pill ok"; pill.firstElementChild.textContent = t("pill_connected"); }
    var rt = $("rumble-title");
    if (rt && gp.vibrationActuator === undefined && rt.dataset.warned !== "1") {
      rt.dataset.warned = "1";
      rt.textContent = t("tester_rumble") + " · " + t("tester_rumble_unsupported");
    }
  }

  function showDisconnected() {
    cur = null; curId = "";
    if ($("empty")) $("empty").hidden = false;
    if ($("live")) $("live").hidden = true;
    var pill = $("pill");
    if (pill) { pill.className = "pill warn"; pill.firstElementChild.textContent = t("tester_waiting"); }
  }

  function update(gp) {
    cur = gp;
    showConnected(gp);

    /* 按键 */
    BTN.forEach(function (b) {
      var pressed = gp.buttons[b.i] ? (gp.buttons[b.i].pressed || gp.buttons[b.i].value > 0.5) : false;
      setPressed($(b.id), pressed);
      if (pressed) seen[b.key] = 1;
    });
    DPAD.forEach(function (d) {
      var pressed = gp.buttons[d.i] ? (gp.buttons[d.i].pressed || gp.buttons[d.i].value > 0.5) : false;
      var el = $(d.id);
      if (el) el.classList.toggle("on", pressed);
      if (pressed) seen[d.key] = 1;
    });

    /* 摇杆 */
    var lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    var ml = moveStick("l", lx, ly), mr = moveStick("r", rx, ry);
    if (ml <= DEADZONE) drift.l = Math.max(drift.l, ml);
    if (mr <= DEADZONE) drift.r = Math.max(drift.r, mr);

    /* 扳机 */
    var lt = gp.buttons[TRIG_L] ? gp.buttons[TRIG_L].value : 0;
    var rt = gp.buttons[TRIG_R] ? gp.buttons[TRIG_R].value : 0;
    var lf = $("trig-l-fill"), rf = $("trig-r-fill");
    if (lf) lf.setAttribute("width", String(Math.round(180 * lt)));
    if (rf) rf.setAttribute("width", String(Math.round(180 * rt)));
    $("trig-l").classList.toggle("on", lt > 0.02);
    $("trig-r").classList.toggle("on", rt > 0.02);
    $("v-lt").textContent = lt.toFixed(2);
    $("v-rt").textContent = rt.toFixed(2);

    /* 数值 */
    $("v-l").textContent = "x " + fmt(lx) + "  y " + fmt(ly);
    $("v-r").textContent = "x " + fmt(rx) + "  y " + fmt(ry);
    var dmax = Math.max(drift.l, drift.r);
    $("v-drift").textContent = fmt(dmax) + "  (" + t("tester_deadzone") + " " + DEADZONE.toFixed(2) + ")";
    var note = $("drift-note");
    if (dmax > DEADZONE) {
      note.textContent = t("tester_drift_bad");
      note.className = "hint warn";
      $("v-drift").style.color = "var(--warn)";
    } else {
      note.textContent = t("tester_drift") + ": " + t("tester_drift_ok");
      note.className = "hint ok";
      $("v-drift").style.color = "";
    }

    /* 按键清单 */
    var keys = allKeys(), done = keys.filter(function (k) { return seen[k]; }).length;
    $("btn-progress").textContent = done + " / " + keys.length + (done === keys.length ? "  " + t("tester_all_pressed") : "  " + t("tester_not_pressed"));
    $("btn-progress").className = "hint " + (done === keys.length ? "ok" : "");
    var chips = $("chips");
    if (chips.childElementCount !== keys.length) {
      chips.innerHTML = "";
      keys.forEach(function (k) {
        var s = document.createElement("span");
        s.className = "chip";
        s.dataset.k = k;
        s.textContent = k;
        chips.appendChild(s);
      });
    }
    for (var i = 0; i < chips.children.length; i++) {
      var c = chips.children[i];
      c.classList.toggle("done", !!seen[c.dataset.k]);
    }

    /* 刷新率 */
    frames++;
    var now = performance.now();
    if (now - hzT >= 1000) { hz = Math.round(frames * 1000 / (now - hzT)); frames = 0; hzT = now; $("dev-poll").textContent = hz + " Hz"; }

    /* 原始数据（限流） */
    if (now - rawT > 120) {
      rawT = now;
      $("raw").textContent = rawText(gp, lx, ly, rx, ry, lt, rt);
    }
  }

  function moveStick(p, x, y) {
    var b = STICKS[p], dot = $("dot-" + p), g = $("stick-" + p);
    var m = Math.sqrt(x * x + y * y);
    var k = m > 1 ? 1 / m : 1;
    if (dot) {
      dot.setAttribute("cx", String((b.x + x * k * STICK_R).toFixed(1)));
      dot.setAttribute("cy", String((b.y + y * k * STICK_R).toFixed(1)));
    }
    if (g) g.classList.toggle("active", m > DEADZONE);
    return m;
  }

  function fmt(v) { return (v >= 0 ? "+" : "") + Number(v).toFixed(3); }

  function rawText(gp, lx, ly, rx, ry, lt, rt) {
    var out = [];
    out.push("id      : " + gp.id);
    out.push("mapping : " + (gp.mapping || "-"));
    out.push("axes    : " + Array.prototype.map.call(gp.axes, function (a) { return Number(a).toFixed(3); }).join(", "));
    out.push("sticks  : L " + fmt(lx) + " " + fmt(ly) + "   R " + fmt(rx) + " " + fmt(ry));
    out.push("trigs   : L " + lt.toFixed(3) + "  R " + rt.toFixed(3));
    var bs = [];
    for (var i = 0; i < gp.buttons.length; i++) if (gp.buttons[i].pressed) bs.push(i + "(" + gp.buttons[i].value.toFixed(2) + ")");
    out.push("buttons : " + (bs.join(" ") || "-"));
    return out.join("\n");
  }

  /* ---------- 演示模式（?demo=1，无手柄也能看效果）---------- */
  var DEMO = /[?&]demo=1/.test(location.search);

  function demoGamepad(ts) {
    var ph = ts / 1000;
    var b = [];
    for (var i = 0; i < 17; i++) b.push({ pressed: false, value: 0 });
    b[0] = { pressed: true, value: 1 };                       // A
    b[4] = { pressed: true, value: 1 };                       // White (LB)
    b[12] = { pressed: true, value: 1 };                      // 十字上
    b[6] = { pressed: false, value: (Math.sin(ph * 1.3) + 1) / 2 };   // LT
    b[7] = { pressed: false, value: (Math.sin(ph * 1.7) + 1) / 2 };   // RT
    return {
      id: "DualSense Wireless Controller (demo)", mapping: "standard", connected: true,
      buttons: b,
      axes: [Math.cos(ph) * 0.62, Math.sin(ph) * 0.62, Math.cos(ph * 0.7) * 0.28, Math.sin(ph * 0.7) * 0.28],
      vibrationActuator: { playEffect: function () { return Promise.resolve("complete"); } }
    };
  }

  /* ---------- 循环 ---------- */
  function loop(ts) {
    var gp = DEMO ? demoGamepad(ts || 0) : pickGamepad();
    if (gp) update(gp);
    else if (cur) showDisconnected();
    requestAnimationFrame(loop);
  }

  /* ---------- 震动 ---------- */
  function doRumble(strong, weak) {
    var gp = pickGamepad();
    if (!gp || !gp.vibrationActuator || !gp.vibrationActuator.playEffect) {
      modal(t("tester_rumble"), t("tester_rumble_unsupported"));
      return;
    }
    try {
      gp.vibrationActuator.playEffect("dual-rumble", {
        startDelay: 0, duration: 500, weakMagnitude: weak, strongMagnitude: strong
      });
    } catch (e) {
      modal(t("tester_rumble"), t("tester_rumble_unsupported"));
    }
  }

  /* ---------- 对话框 ---------- */
  function modal(title, body) {
    var ov = $("modal");
    $("m-title").textContent = title;
    $("m-body").textContent = body;
    ov.hidden = false;
    $("m-ok").onclick = function () { ov.hidden = true; };
  }

  /* ---------- 报告 ---------- */
  function report() {
    var gp = cur || pickGamepad();
    var L = [];
    L.push("LinkRetro Controller Tester");
    L.push("date     : " + new Date().toISOString());
    if (!gp) { L.push("gamepad  : (none)"); return L.join("\n"); }
    L.push("device   : " + gp.id);
    L.push("family   : " + fam.id);
    L.push("mapping  : " + (gp.mapping || "-"));
    L.push("axes     : " + gp.axes.length + "   buttons: " + gp.buttons.length);
    L.push("polling  : ~" + hz + " Hz");
    L.push("sticks   : L " + fmt(gp.axes[0] || 0) + " " + fmt(gp.axes[1] || 0) +
           "   R " + fmt(gp.axes[2] || 0) + " " + fmt(gp.axes[3] || 0));
    L.push("drift    : L " + drift.l.toFixed(4) + "  R " + drift.r.toFixed(4) +
           "  (deadzone ref " + DEADZONE.toFixed(2) + ")");
    L.push("triggers : L " + (gp.buttons[TRIG_L] ? gp.buttons[TRIG_L].value.toFixed(3) : "-") +
           "  R " + (gp.buttons[TRIG_R] ? gp.buttons[TRIG_R].value.toFixed(3) : "-"));
    var keys = allKeys();
    L.push("tested   : " + keys.filter(function (k) { return seen[k]; }).join(" ") || "(none)");
    L.push("missing  : " + (keys.filter(function (k) { return !seen[k]; }).join(" ") || "(none)"));
    return L.join("\n");
  }

  /* ---------- 初始化 ---------- */
  function render() {
    I.applyStatic();
    I.mountSelect($("lang"), render);
    drawSrcLabels();
  }

  function init() {
    I.applyStatic();
    I.mountSelect($("lang"), render);
    drawSrcLabels();

    $("btn-reset").addEventListener("click", function () {
      seen = {}; drift = { l: 0, r: 0 };
    });
    $("btn-rumble-weak").addEventListener("click", function () { doRumble(0.2, 0.5); });
    $("btn-rumble-strong").addEventListener("click", function () { doRumble(0.9, 0.2); });
    $("btn-rumble-both").addEventListener("click", function () { doRumble(0.9, 0.9); });
    $("btn-copy").addEventListener("click", function () {
      var txt = report();
      var done = function () {
        var b = $("btn-copy");
        b.textContent = t("adv_copied");
        setTimeout(function () { b.textContent = t("tester_copy"); }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt, done); });
      } else fallbackCopy(txt, done);
    });

    /* 连接/断开由 requestAnimationFrame 轮询检测，无需事件 */

    if (!navigator.getGamepads) {
      var b = $("banner");
      if (b) { $("banner-title").textContent = t("web_banner_title"); $("banner-body").textContent = t("web_need_chrome"); b.hidden = false; }
    }
    if (!DEMO) showDisconnected();
    requestAnimationFrame(loop);
  }

  function fallbackCopy(txt, done) {
    var ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
