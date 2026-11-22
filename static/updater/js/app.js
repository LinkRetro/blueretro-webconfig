/*!
 * app.js — LinkRetro 网页版固件更新工具（USB 串口版）界面与状态机
 *
 * 基于开源项目 BlueRetro（作者 darthcloud，Apache License 2.0）
 * 烧录内核：esptool-js 0.7.0（Espressif，Apache License 2.0）
 * 许可：Apache License 2.0
 */
(function () {
  "use strict";

  var S = window.BRFW_STRINGS || {};
  var LANGS = window.BRFW_LANGS || ["zh-CN", "zh-TW", "en"];
  var LANG_LABEL = window.BRFW_LANG_NAMES || { "zh-CN": "简体中文", "zh-TW": "繁體中文", "en": "English" };
  var R = window.BRFWRunner;
  var IMG = window.BRFWImage;

  var lang = "en";
  var fw = null;          // { name, size, bytes, kind, offset, version }
  var connected = false;
  var busy = false;
  var outcome = "";       // "" | "done" | "fail"
  var chip = "";
  var lastPortTxt = "";
  var logLines = [];

  function $(id) { return document.getElementById(id); }

  /* 固定英文文案（不再走多语言表） */
  var TXT_DEV_HINT = "Plug the receiver into a USB port. If it does not show up, click \u201cDetect again\u201d and pick its COM port in the dialog.";
  var TXT_FW_HINT = "Pick the firmware for your console. It is selected automatically once the receiver is detected.";
  var TXT_CONNECTED = "Connected \u2014 press Start update";

  /* ---------------- 文案 ---------------- */
  function t(key, vars) {
    var s = (S[lang] && S[lang][key]) || (S["en"] && S["en"][key]) ||
            (S["zh-CN"] && S["zh-CN"][key]) || key;
    if (vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) {
        return (vars[k] === undefined || vars[k] === null) ? m : String(vars[k]);
      });
    }
    return s;
  }

  /* 本工具固定英文（配置工具也是英文界面，不再提供语言切换） */
  function detectLang() {
    return "en";
  }

  function setLang(l) {
    if (!S[l]) return;
    lang = l;
    try { localStorage.setItem("brfw.lang", l); } catch (e) { /* ignore */ }
    render();
    // 内置固件下拉框的占位文案也要跟着语言走
    if (typeof syncFwSelectText === "function") syncFwSelectText();
  }

  /* ---------------- 日志 ---------------- */
  function log(line) {
    line = String(line == null ? "" : line).replace(/\s+$/, "");
    if (!line) return;
    // esptool-js 的行内进度（\r 刷新）会重复，做一下去重
    if (logLines.length && logLines[logLines.length - 1] === line) return;
    logLines.push(line);
    if (logLines.length > 800) logLines.splice(0, logLines.length - 800);
    var el = $("log");
    if (el) { el.textContent = logLines.join("\n"); el.scrollTop = el.scrollHeight; }
  }

  /* ---------------- 渲染 ---------------- */
  function setHint(id, text, cls) {
    var el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = "hint" + (cls ? " " + cls : "");
    el.style.display = text ? "" : "none";   // 空提示不占位
  }

  function setPhase(text) { var el = $("phase"); if (el) el.textContent = text; }

  function setBar(pct, cls) {
    var el = $("bar");
    if (!el) return;
    el.style.width = Math.max(0, Math.min(100, pct)) + "%";
    el.className = "bar-fill" + (cls ? " " + cls : "");
  }

  function fmtSize(n) {
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return Math.round(n / 1024) + " KB";
  }

  function pillState() {
    if (busy) return ["pill_writing", "info"];
    if (outcome === "done") return ["pill_done", "ok"];
    if (outcome === "fail") return ["pill_error", "err"];
    if (connected) return [fw ? "pill_ready" : "pill_connected", "ok"];
    return ["pill_plug", "warn"];
  }

  function render() {
    // 静态文案
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
    document.documentElement.lang = lang;
    document.title = t("app_title_serial");

    // 语言下拉
    var sel = null;   /* 语言切换已移除，固定英文 */
    if (sel && sel.options.length !== LANGS.length) {
      sel.innerHTML = "";
      for (var j = 0; j < LANGS.length; j++) {
        var o = document.createElement("option");
        o.value = LANGS[j];
        o.textContent = LANG_LABEL[LANGS[j]] || LANGS[j];
        sel.appendChild(o);
      }
    }
    if (sel) { sel.value = lang; sel.title = t("adv_lang"); }

    // ① 固件
    var fb = $("filebox");
    if (fb) {
      if (fw) {
        fb.classList.remove("empty");
        fb.textContent = fw.name + "   ·   " + fmtSize(fw.size);
        fb.title = fw.name;
      } else {
        fb.classList.add("empty");
        fb.title = "";
      }
    }
    // 内置固件摘要行：文件名 + 是否最新版
    var line = $("fwline"), fwFile = $("fwfile"), fwBadge = $("fwlatest");
    if (line) {
      var fromSite = !!(fw && fwPickedFromSite && fw.name === fwPickedFromSite);
      if (fromSite) {
        line.hidden = false;
        if (fwFile) { fwFile.textContent = fw.name + "  ·  " + fmtSize(fw.size); fwFile.title = fw.name; }
        if (fwBadge) fwBadge.hidden = !isLatestFirmware(fw.name);
      } else {
        line.hidden = true;
        if (fwBadge) fwBadge.hidden = true;
      }
    }
    setHint("fw-hint", fw ? "" : TXT_FW_HINT, "");

    // ② 设备
    var dev = $("dev");
    if (dev) {
      if (busy && !connected) { dev.textContent = t("dev_detecting"); dev.className = "dev"; }
      else if (connected) { dev.textContent = t("dev_connected"); dev.className = "dev ok"; }
      else { dev.textContent = t("dev_notfound"); dev.className = "dev"; }
    }

    // 设备上固件的版本 / 编译时间，认出型号时带上匹配结果
    var devMeta = $("devmeta");
    if (devMeta) {
      if (!connected) devDesc = null;
      if (connected && devDesc) {
        var bits = [devDesc.project, (devDesc.date + " " + devDesc.time).trim()];
        if (devDesc.version && devDesc.version !== "1") bits.splice(1, 0, "v" + devDesc.version);
        if (devMatch) bits.push("→ " + devMatch);
        devMeta.textContent = bits.filter(Boolean).join("  ·  ");
        devMeta.hidden = false;
      } else {
        devMeta.textContent = "";
        devMeta.hidden = true;
      }
    }
    if (connected) {
      setHint("dev-hint", "", "");   /* JZW: 串口号只留在「高级选项」里 */
    } else if (!devHintLocked) {
      // 初始状态：这条一定要醒目，用户第一眼就该看到"插设备 + 选串口"
      setHint("dev-hint", TXT_DEV_HINT, "warn pulse");
    }

    // ③ 状态胶囊
    var ps = pillState();
    var pill = $("pill");
    if (pill) {
      pill.className = "pill " + ps[1];
      pill.firstElementChild.textContent = t(ps[0]);
    }

    // 按钮
    var btn = $("btn-start");
    if (btn) {
      btn.textContent = busy ? t("btn_updating") : t("btn_start");
      btn.disabled = busy;
    }
    var bc = $("btn-choose");
    if (bc) bc.disabled = busy;
    var br = $("btn-recheck");
    if (br) br.disabled = busy;
    var ba = $("adv-port");
    if (ba) ba.textContent = lastPortTxt || t("adv_auto");
  }

  var devHintLocked = false;
  var noportRetried = false;   // 「显示所有串口」只自动提示一次

  /* ---------------- 对话框 ---------------- */
  function modal(opt) {
    return new Promise(function (resolve) {
      var ov = $("modal"), okB = $("m-ok"), caB = $("m-cancel"), alB = $("m-alt");
      $("m-title").textContent = opt.title || t("tip_title");
      $("m-body").textContent = opt.body || "";
      okB.textContent = opt.okText || t("btn_ok");
      caB.textContent = opt.cancelText || t("btn_cancel");
      caB.hidden = !opt.cancel;
      alB.hidden = !opt.alt;
      if (opt.alt) alB.textContent = opt.altText || "";
      ov.hidden = false;
      (opt.cancel ? caB : okB).focus();
      function done(v) {
        ov.hidden = true;
        okB.onclick = caB.onclick = alB.onclick = null;
        resolve(v);
      }
      okB.onclick = function () { done("ok"); };
      caB.onclick = function () { done("cancel"); };
      alB.onclick = function () { done("alt"); };
    });
  }

  /* ---------------- 选固件 ---------------- */
  async function onFile(file) {
    if (!file) return;
    if (!/\.bin$/i.test(file.name)) {
      await modal({ title: t("err_fw_title"), body: t("err_need_bin") });
      return;
    }
    try {
      var buf = await file.arrayBuffer();
      var bytes = new Uint8Array(buf);
      var info = IMG.analyze(bytes);
      if (!info.ok) {
        await modal({ title: t("err_fw_title"), body: t(info.err) });
        return;
      }
      fw = {
        name: file.name, size: info.size, bytes: bytes,
        kind: info.kind, offset: info.offset, version: info.version
      };
      outcome = "";
      log("[fw] " + file.name + "  " + fmtSize(info.size) +
          "  kind=" + info.kind + "  offset=0x" + info.offset.toString(16).toUpperCase() +
          (info.version ? "  ver=" + info.version : ""));
      render();
    } catch (e) {
      log("[fail] read firmware: " + (e && e.message ? e.message : e));
      await modal({ title: t("err_fw_title"), body: t("body_write_failed") });
    }
  }

  /* ---------------- 站点内置固件清单 ---------------- */
  /* 构建时 tools/sync-firmware.mjs 会把 firmware\*.bin 同步到 /firmware/ 并生成 index.json。
     这里把清单渲染成按钮，点一下就从站点取文件、走同一条 onFile 校验流程。
     取不到清单（比如用 file:// 直接打开）就静默跳过，仍可用「选择固件…」手动挑。 */
  var fwIndex = [];
  var fwPickedFromSite = "";
  var devDesc = null;     // 设备上固件的 app 描述符 { version, project, time, date }
  var devMatch = "";      // 由描述符匹配到的型号标签

  function fmtMB(n) {
    return (n / 1048576).toFixed(2) + " MB";
  }

  function renderFwList() {
    var box = $("fwlist");
    var sel = $("fwselect");
    if (!box || !sel) return;
    sel.innerHTML = "";
    if (!fwIndex.length) { box.hidden = true; document.body.classList.remove("has-fwlist"); return; }
    box.hidden = false;
    document.body.classList.add("has-fwlist");

    var ph = document.createElement("option");
    ph.value = "";
    ph.textContent = t("pkg_none");
    sel.appendChild(ph);

    fwIndex.forEach(function (item) {
      var o = document.createElement("option");
      o.value = item.name;
      o.textContent = [item.label, item.meta].filter(Boolean).join(" — ");
      sel.appendChild(o);
    });
    sel.value = fwPickedFromSite || "";
  }

  /* 语言切换时占位文案要跟着变，选项里的型号名不用翻 */
  function syncFwSelectText() {
    var sel = $("fwselect");
    if (!sel || !fwIndex.length || !sel.options.length) return;
    sel.options[0].textContent = t("pkg_none");
  }

  async function pickSiteFirmware(item) {
    try {
      var res = await fetch("../firmware/" + encodeURIComponent(item.name), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var blob = await res.blob();
      var file = new File([blob], item.name, { type: "application/octet-stream" });
      await onFile(file);
      if (fw && fw.name === item.name) {
        fwPickedFromSite = item.name;
        renderFwList();
        render();   // 让「文件名 + 是否最新」这一行立刻刷新
      }
    } catch (e) {
      log("[fail] load built-in firmware: " + (e && e.message ? e.message : e));
      fwPickedFromSite = "";
      var sel = $("fwselect");
      if (sel) sel.value = "";
    }
  }

  async function loadFwIndex() {
    try {
      var res = await fetch("../firmware/index.json", { cache: "no-store" });
      if (!res.ok) return;
      var list = await res.json();
      if (Array.isArray(list) && list.length) { fwIndex = list; renderFwList(); }
    } catch (e) { /* 没有清单就用本地选文件 */ }
  }

  /* 当前选中的是否该型号里最新的一份（按文件名日期 → 版本排序） */
  function isLatestFirmware(name) {
    if (!fwIndex.length) return false;
    var cur = null, i;
    for (i = 0; i < fwIndex.length; i++) { if (fwIndex[i].name === name) cur = fwIndex[i]; }
    if (!cur) return false;
    var pool = fwIndex.filter(function (f) { return cur.target ? f.target === cur.target : true; });
    if (!pool.length) pool = fwIndex.slice();
    pool.sort(function (a, b) {
      var da = String(a.date || ""), db = String(b.date || "");
      if (da !== db) return da < db ? 1 : -1;
      return String(a.version || "") < String(b.version || "") ? 1 : -1;
    });
    return pool[0].name === name;
  }

  /* ---------------- 按设备固件自动选型号 ---------------- */
  /* 三个型号的 app 描述符里 version 都是 "1"、project 都是 BlueRetro，
     能区分的只有编译时间（date + time）。所以用「设备回读的编译时间」
     去清单里找同一份构建，得到型号，再在该型号里挑最新的一份。 */
  function autoPickFirmware(desc) {
    devMatch = "";
    if (!fwIndex.length || !desc) return;

    var exact = null;
    for (var i = 0; i < fwIndex.length; i++) {
      var b = fwIndex[i].build;
      if (b && b.date === desc.date && b.time === desc.time) { exact = fwIndex[i]; break; }
    }
    if (!exact || !exact.target) {
      log("[match] build not in the list, model unknown — pick manually");
      render();
      return;
    }

    var pool = fwIndex.filter(function (f) { return f.target === exact.target; });
    pool.sort(function (a, b) {
      var da = String(a.date || ""), db = String(b.date || "");
      if (da !== db) return da < db ? 1 : -1;
      return String(a.version || "") < String(b.version || "") ? 1 : -1;
    });
    var pick = pool[0];
    devMatch = pick.label;
    log("[match] device = " + pick.label + "  ->  " + pick.name);

    // 记下型号，蓝牙面板（同一 origin）会自动沿用
    try { localStorage.setItem("brfw.deviceModel", exact.target); } catch (e) { /* ignore */ }

    // 已经手动选了本地文件就不覆盖；否则自动选好
    if (!fw || fwPickedFromSite) {
      if (!fw || fw.name !== pick.name) pickSiteFirmware(pick);
    } else {
      log("[match] keep your local file selection");
    }
    render();
  }

  /* ---------------- 连接 ---------------- */
  async function connectInner(opt) {
    devHintLocked = false;
    busy = true; render();
    setPhase(t("phase_connecting"));
    try {
      var name = await R.connect({
        all: !!(opt && opt.all),
        forcePick: !!(opt && opt.forcePick),
        allowPrompt: !!(opt && opt.allowPrompt),   // 只有点击直呼时才允许弹窗
        onLog: log
      });
      connected = true;
      chip = name;
      try { lastPortTxt = R.describe(R.state().port); } catch (e) { lastPortTxt = ""; }
      log("[ok] connected: " + name + (lastPortTxt ? "  " + lastPortTxt : ""));

      // 顺手读一次设备上的固件信息：能认出型号就自动选好对应的最新固件
      try {
        var dv = await R.readVersion();
        if (dv && dv.desc) {
          devDesc = dv.desc;
          log("[dev] " + [dv.desc.project, "v" + (dv.desc.version || "?"), (dv.desc.date + " " + dv.desc.time).trim()]
            .filter(Boolean).join("  "));
          autoPickFirmware(dv.desc);
        }
      } catch (e) {
        log("[dev] read app descriptor failed: " + (e && e.message ? e.message : e));
      }
      return true;
    } catch (e) {
      connected = false;
      var msg = (e && e.message) || String(e);
      if (msg === "UNSUPPORTED" || msg === "INSECURE") throw e;
      if (e && (e.name === "NotFoundError" || msg === "NO_PORT")) throw { kind: "noport" };
      log("[fail] connect: " + (e && (e.stack || e.message) || e));
      throw { kind: "connect", raw: e };
    } finally {
      busy = false;
      render();
    }
  }

  /** 连接失败后的"换个方式试试"引导（与桌面版一致） */
  async function manualFlow(kind) {
    if (kind === "noport") {
      devHintLocked = true;
      setHint("dev-hint", t("tip_no_port"), "warn");
      setPhase(t("phase_conn_failed"));
      render();
      // 过滤列表里没有你的芯片时，浏览器会提示"找不到兼容的设备"。
      // 这里给一个不带过滤的兜底入口，再弹一次完整串口列表。
      var canRetryAll = !noportRetried;
      var a2 = await modal({
        title: t("tip_title"),
        body: t("tip_no_port") + (canRetryAll ? "" : "\n\n"),
        alt: canRetryAll, altText: t("adv_show_all"),
        cancel: canRetryAll, cancelText: t("btn_cancel")
      });
      devHintLocked = false;
      if (a2 === "alt" && canRetryAll) {
        noportRetried = true;
        outcome = ""; setBar(0, "");
        try { await connectInner({ all: true, forcePick: true, allowPrompt: true }); setPhase(t("phase_ready")); }
        catch (e2) { await manualFlow(e2 && e2.kind ? e2.kind : "connect"); }
      }
      return;
    }
    setPhase(t("phase_conn_failed"));
    var ans = await modal({
      title: t("ask_manual_title"),
      body: t("ask_manual_body"),
      cancel: true,
      okText: t("btn_yes"),
      cancelText: t("btn_no")
    });
    if (ans !== "ok") {
      devHintLocked = true;
      setHint("dev-hint", t("body_conn_failed"), "warn");
      render();
      return;
    }
    // 用户去按 BOOT/RST；这里立刻再试一次（很多板子第二次就同步上了）
    try {
      await connectInner({});
      setPhase(TXT_CONNECTED);
    } catch (e2) {
      devHintLocked = true;
      setHint("dev-hint", t("body_conn_failed"), "warn");
      setPhase(t("phase_conn_failed"));
      render();
      await modal({ title: t("tip_title"), body: t("body_conn_failed") });
    }
  }

  /* ---------------- 更新主流程 ---------------- */
  async function runUpdate() {
    busy = true; outcome = ""; devHintLocked = false;
    setBar(0, ""); setPhase(t("phase_prepare")); render();
    try {
      if (!connected) await connectInner({});
      setPhase(t("phase_ready"));
      setBar(2, "");
      await R.flash(fw.bytes, fw.offset, function (written, total) {
        var pct = total ? Math.max(2, Math.round(written / total * 100)) : 0;
        setPhase(t("phase_writing_pct", { pct: pct }));
        setBar(pct, "");
      });
      setBar(100, "");
      setPhase(t("phase_write_done"));
      setPhase(t("phase_verifying"));
      var rd = await R.readVersion();
      if (fw.version && rd.version && rd.version !== fw.version) {
        throw { kind: "verify", dev: rd.version, pkg: fw.version };
      }
      log("[ok] verified" + (rd.version ? " version=" + rd.version : " (magic ok)"));
      await R.reset();
      // 刷完就把串口放掉：设备会重新枚举，网页不该继续占着旧端口
      await R.disconnect();
      connected = false;
      chip = "";
      outcome = "done";
      setBar(100, "done");
      setPhase(t("phase_done"));
      busy = false; render();
      await modal({ title: t("ok_title"), body: t("ok_body") });
    } catch (e) {
      busy = false;
      outcome = "fail";
      setBar(0, "fail");
      if (e && e.kind === "verify") {
        setPhase(t("phase_verify_fail"));
        render();
        await modal({
          title: t("fail_title"),
          body: t("body_verify_failed", { dev: e.dev || "-", pkg: e.pkg || "-" })
        });
      } else if (e && (e.kind === "connect" || e.kind === "noport")) {
        render();
        await manualFlow(e.kind);
      } else if (e && (e.message === "UNSUPPORTED" || e.message === "INSECURE")) {
        render();
        showBanner(e.message);
      } else {
        setPhase(t("phase_write_failed"));
        render();
        log("[fail] " + (e && (e.stack || e.message) || e));
        await modal({ title: t("fail_title"), body: t("body_write_failed") });
      }
    } finally {
      if (!busy) render();
    }
  }

  async function onStart() {
    if (busy) return;
    if (!fw) { await modal({ title: t("tip_title"), body: t("err_need_bin") }); return; }
    var portTxt = lastPortTxt || t("adv_auto");
    var ans = await modal({
      title: t("confirm_title"),
      body: t("confirm_body", { port: portTxt, ver: fw.version || "-" }),
      cancel: true,
      okText: t("btn_ok"),
      cancelText: t("btn_cancel")
    });
    if (ans !== "ok") return;
    await runUpdate();
  }

  /* 设备被拔掉：清状态、把提示切回"插上 USB"、日志留痕 */
  function onPortGone() {
    var wasBusy = busy;
    connected = false;
    chip = "";
    lastPortTxt = "";
    devDesc = null;
    devMatch = "";
    devHintLocked = false;
    busy = false;
    log("[dev] serial port disconnected");
    if (wasBusy && outcome !== "done") {
      outcome = "fail";
      setBar(0, "fail");
      setPhase(t("phase_write_failed"));
    } else if (outcome !== "done") {
      outcome = "";
      setBar(0, "");
      setPhase("");
    }
    render();
  }

  async function onRecheck() {
    if (busy) return;
    noportRetried = false;
    outcome = "";
    setBar(0, "");
    try {
      await connectInner({ forcePick: true, allowPrompt: true });
      setPhase(t("phase_ready"));
    } catch (e) {
      await manualFlow(e && e.kind ? e.kind : "connect");
    }
  }

  /* ---------------- 横幅（浏览器不支持）---------------- */
  function showBanner(code) {
    var b = $("banner");
    if (!b) return;
    $("banner-title").textContent = t("web_banner_title");
    $("banner-body").textContent = t(code === "INSECURE" ? "web_secure" : "web_need_chrome");
    b.hidden = false;
  }

  /* ---------------- 演示模式（无硬件截图/展示用）----------------
   * 用法： index.html?demo=1
   */
  function demoMode() {
    fw = {
      name: "linkretro-rx-25.10-ps12-both.bin", size: 663984,
      bytes: new Uint8Array(0), kind: "merged", offset: 0, version: "1"
    };
    connected = true; chip = "ESP32-PICO-D4"; lastPortTxt = "USB 1A86:7523";
    busy = true;
    render();
    setBar(62, "");
    setPhase(t("phase_writing_pct", { pct: 62 }));
    log("[demo] simulated state, no device involved");
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    lang = detectLang();
    if (/[?&]demo=1/.test(location.search)) { demoMode(); return; }

    $("btn-choose").addEventListener("click", function () { $("file-input").click(); });
    $("file-input").addEventListener("change", function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = "";
      fwPickedFromSite = "";
      renderFwList();
      onFile(f);
    });
    $("fwselect").addEventListener("change", function (ev) {
      var name = ev.target.value;
      if (!name) { fwPickedFromSite = ""; return; }
      for (var i = 0; i < fwIndex.length; i++) {
        if (fwIndex[i].name === name) { pickSiteFirmware(fwIndex[i]); return; }
      }
    });
    $("btn-start").addEventListener("click", onStart);
    $("btn-recheck").addEventListener("click", onRecheck);

    // 高级选项
    $("btn-adv").addEventListener("click", function () { $("adv").hidden = false; });
    $("btn-closeadv").addEventListener("click", function () { $("adv").hidden = true; });
    $("btn-clearlog").addEventListener("click", function () {
      logLines = []; $("log").textContent = "";
    });
    $("btn-copylog").addEventListener("click", async function () {
      var txt = logLines.join("\n");
      try {
        await navigator.clipboard.writeText(txt);
        $("btn-copylog").textContent = t("adv_copied");
        setTimeout(function () { $("btn-copylog").textContent = t("adv_copy"); }, 1400);
      } catch (e) {
        // file:// 下剪贴板可能不可用：退回到选中文本让用户自己复制
        var el = $("log"); var r = document.createRange();
        r.selectNodeContents(el);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
    });
    /* 语言切换已移除（固定英文） */
    $("btn-showall").addEventListener("click", async function () {
      $("adv").hidden = true;
      outcome = ""; setBar(0, "");
      try { await connectInner({ all: true, forcePick: true , allowPrompt: true }); setPhase(t("phase_ready")); }
      catch (e) { await manualFlow(e && e.kind ? e.kind : "connect"); }
    });
    $("btn-readver").addEventListener("click", async function () {
      if (busy) return;
      try {
        if (!connected) await connectInner({ forcePick: true , allowPrompt: true });
        var rd = await R.readVersion();
        var d = rd.desc || null;
        var lines = [];
        if (d) {
          lines.push("project : " + (d.project || "-"));
          lines.push("version : " + (d.version || "-"));
          lines.push("built   : " + ((d.date + " " + d.time).trim() || "-"));
          log("[ver] " + [d.project, "v" + d.version, d.date, d.time].filter(Boolean).join("  "));
        } else {
          lines.push("version : " + (rd.version || "(empty)"));
          log("[ver] " + (rd.version || "(empty)"));
        }
        if (devMatch) lines.push("model   : " + devMatch);
        await modal({ title: t("adv_readver"), body: lines.join("\n") });
      } catch (e) { await manualFlow(e && e.kind ? e.kind : "connect"); }
    });
    $("btn-erase").addEventListener("click", async function () {
      if (busy) return;
      var a = await modal({ title: t("adv_erase_title"), body: t("adv_erase_body"), cancel: true });
      if (a !== "ok") return;
      try {
        if (!connected) await connectInner({ forcePick: true , allowPrompt: true });
        await R.eraseAll();
        await modal({ title: t("adv_erase_ok"), body: t("adv_erase_ok_body") });
      } catch (e) {
        await modal({ title: t("adv_erase_fail"), body: t("adv_erase_fail_body") });
      }
    });

    // 关闭保护
    window.addEventListener("beforeunload", function (e) {
      if (busy) { e.preventDefault(); e.returnValue = t("close_body"); return t("close_body"); }
    });
    // 未捕获异常也写进日志，方便支持
    window.addEventListener("error", function (e) { log("[error] " + e.message); });
    window.addEventListener("unhandledrejection", function (e) {
      log("[error] " + ((e.reason && e.reason.message) || e.reason));
    });

    // 拔线：浏览器会在端口上派发 disconnect，这里把界面状态收拾干净
    R.onDisconnect(onPortGone);

    // 能力检测
    if (!R.supported()) showBanner("UNSUPPORTED");
    else if (!R.secure()) showBanner("INSECURE");

    setPhase("");
    render();
    loadFwIndex();
    syncFwSelectText();

    // 在后台看一眼有没有已授权过的串口（不会弹窗）
    (async function () {
      try {
        var g = await navigator.serial.getPorts();
        log("[port] authorized ports: " + g.length);
        if (g.length) {
          lastPortTxt = R.describe(g[0]);
        }
      } catch (e) { /* ignore */ }
      render();
    })();
  }

  // 调试钩子：?debug=1 时把内部状态挂到 window，方便没有设备时验证「按固件版本匹配型号」的逻辑
  if (/[?&]debug=1/.test(location.search)) {
    window.__brfw = {
      index: function () { return fwIndex; },
      state: function () {
        return { devDesc: devDesc, devMatch: devMatch, fw: fw ? fw.name : "", pickedFromSite: fwPickedFromSite };
      },
      autoPick: function (desc) { autoPickFirmware(desc); },
      simulateDisconnect: function () { onPortGone(); },
      describeFlash: function (buf) { return window.BRFWImage.describeFlash(buf); }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
