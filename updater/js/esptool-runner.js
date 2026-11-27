/*!
 * esptool-runner.js — WebSerial + esptool-js 封装（网页版）
 *
 * 只负责"和芯片打交道"，不含任何界面逻辑：
 *   连接 / 烧录 / 回读校验 / 擦除 / 复位 / 断开
 *
 * 依赖：vendor/esptool-js.js（esptool-js 0.7.0，Apache-2.0）
 * 许可：Apache License 2.0
 */
window.BRFWRunner = (function () {
  "use strict";

  var esp = window.esptooljs;

  // 常见 USB 串口芯片。注意：这个列表只影响"默认弹窗里显示哪些口"，
  // 选不到时界面会给出「显示所有串口」的兜底入口（不带过滤地再弹一次）。
  var USB_SERIAL_FILTERS = [
    { usbVendorId: 0x1A86 },   // WCH        CH340 / CH341 / CH9102
    { usbVendorId: 0x10C4 },   // Silicon Labs CP210x
    { usbVendorId: 0x0403 },   // FTDI
    { usbVendorId: 0x067B },   // Prolific   PL2303
    { usbVendorId: 0x303A },   // Espressif  原生 USB-Serial-JTAG
    { usbVendorId: 0x0ACE },   // ★ OGX-Mini / RP2040 桥接版的自定义 CDC（VID 0x0ACE，PID 0x4001）
    { usbVendorId: 0x2E8A },   // Raspberry Pi（标准 Pico CDC）
    { usbVendorId: 0x239A },   // Adafruit
    { usbVendorId: 0x1209 }    // pid.codes（开源硬件常用）
  ];

  var BAUD = 115200;           // 与桌面版一致；直连 CH340 稳定优先

  var S = { port: null, transport: null, loader: null, chip: "" };

  function supported() {
    return !!(navigator.serial && esp &&
              typeof esp.ESPLoader === "function" &&
              typeof esp.Transport === "function");
  }

  function secure() {
    return window.isSecureContext === true;
  }

  /** 端口描述，例如 "USB 1A86:7523"；拿不到就返回空串 */
  function describe(port) {
    try {
      var i = port.getInfo ? port.getInfo() : {};
      if (i && i.usbVendorId) {
        var v = ("0000" + i.usbVendorId.toString(16)).slice(-4).toUpperCase();
        var p = i.usbProductId ? ("0000" + i.usbProductId.toString(16)).slice(-4).toUpperCase() : "????";
        return "USB " + v + ":" + p;
      }
    } catch (e) { /* ignore */ }
    return "";
  }

  /**
   * 取端口。
   * 注意：navigator.serial.requestPort() 需要"瞬时用户激活"，在异步链里（经过任何 await）
   * 再调用必定报 "Must be handling a user gesture"。所以只有 allowPrompt=true
   * （即由点击处理函数直接调用）时才弹窗；否则只用已授权端口，拿不到就报 NO_PORT。
   */
  async function requestPort(opt) {
    opt = opt || {};
    var granted = [];
    try { granted = await navigator.serial.getPorts(); } catch (e) { granted = []; }
    if (granted.length && !opt.forcePick) return granted[0];
    if (!opt.allowPrompt) throw new Error("NO_PORT");
    return await navigator.serial.requestPort(opt.all ? {} : { filters: USB_SERIAL_FILTERS });
  }

  async function disconnect() {
    detachPort();
    try { if (S.transport) await S.transport.disconnect(); } catch (e) { /* ignore */ }
    S.transport = null; S.loader = null; S.port = null; S.chip = "";
  }

  /* ---- 拔线检测 ----
   * 设备被拔掉时浏览器会在 SerialPort 上派发 disconnect 事件；
   * 这时 transport 已经没用了，必须自己把状态清干净，
   * 否则界面还显示「已连接」，再点检测也会拿早就消失的端口。 */
  var onDisconnectCb = null;
  var portGoneHandler = null;

  function onDisconnect(fn) { onDisconnectCb = fn || null; }

  function detachPort() {
    if (S.port && portGoneHandler) {
      try { S.port.removeEventListener("disconnect", portGoneHandler); } catch (e) { /* ignore */ }
    }
    portGoneHandler = null;
  }

  function attachPort(port) {
    detachPort();
    if (!port || !port.addEventListener) return;
    portGoneHandler = function () {
      S.transport = null; S.loader = null; S.port = null; S.chip = "";
      portGoneHandler = null;
      try { if (onDisconnectCb) onDisconnectCb(); } catch (e) { /* ignore */ }
    };
    try { port.addEventListener("disconnect", portGoneHandler); } catch (e) { /* ignore */ }
  }

  /**
   * 连接芯片。
   * @param opt  { all?:boolean, forcePick?:boolean, onLog?:function }
   * @returns    芯片名，例如 "ESP32-PICO-D4"
   */
  async function connect(opt) {
    opt = opt || {};
    if (!supported()) throw new Error("UNSUPPORTED");
    if (!secure()) throw new Error("INSECURE");
    await disconnect();

    S.port = await requestPort({ all: !!opt.all, forcePick: !!opt.forcePick, allowPrompt: !!opt.allowPrompt });
    attachPort(S.port);

    var terminal = {
      clean: function () {},
      write: function (d) { opt.onLog && opt.onLog(String(d)); },
      writeLine: function (d) { opt.onLog && opt.onLog(String(d) + "\n"); }
    };

    S.transport = new esp.Transport(S.port, true);
    S.loader = new esp.ESPLoader({
      transport: S.transport,
      baudrate: BAUD,
      terminal: terminal,
      debugLogging: false
    });

    S.chip = await S.loader.main();
    return S.chip;
  }

  /** 写入固件 @param bytes Uint8Array, @param offset 起始地址 */
  async function flash(bytes, offset, onProgress) {
    if (!S.loader) throw new Error("NOT_CONNECTED");
    await S.loader.writeFlash({
      fileArray: [{ data: bytes, address: offset }],
      flashMode: "dio",
      flashFreq: "40m",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: function (idx, written, total) {
        if (onProgress) onProgress(written, total);
      }
    });
  }

  /**
   * 回读 app 描述符（写完后仍在 bootloader，直接读最可靠）。
   * 读 0x80 字节：版本 + 工程名 + 编译时间/日期，用来判断设备上跑的是哪个型号。
   */
  async function readVersion() {
    if (!S.loader) throw new Error("NOT_CONNECTED");
    var rd = await S.loader.readFlash(0x10020, 0x80, function () {});
    var desc = window.BRFWImage.describeFlash(rd);
    return {
      raw: rd,
      version: (desc && desc.version) || window.BRFWImage.versionFromFlash(rd),
      desc: desc
    };
  }

  async function eraseAll() {
    if (!S.loader) throw new Error("NOT_CONNECTED");
    await S.loader.eraseFlash();
  }

  async function reset() {
    if (!S.loader) return;
    try { await S.loader.after("hard_reset"); } catch (e) { /* 复位失败不影响"已写入"的结论 */ }
  }

  return {
    supported: supported,
    secure: secure,
    describe: describe,
    connect: connect,
    flash: flash,
    readVersion: readVersion,
    eraseAll: eraseAll,
    reset: reset,
    disconnect: disconnect,
    onDisconnect: onDisconnect,
    state: function () { return { port: S.port, chip: S.chip, connected: !!S.loader }; }
  };
})();
