/*!
 * image.js — ESP32 固件镜像解析（网页版）
 *
 * 与桌面版 Update_APP/通用/fw-updater-ch340/fw_updater_ch340.py 的 load_firmware() 规则一致：
 *   · 应用固件（只能单独烧）  -> 烧到 0x10000，app 描述符在文件 0x20
 *   · 完整合并镜像（工厂包）  -> 烧到 0x0，app 描述符在文件 0x10020
 * 版本号 = app 描述符魔数后 0x10 字节处的 32 字节 ASCII 串。
 *
 * 许可：Apache License 2.0
 */
window.BRFWImage = (function () {
  "use strict";

  var APP_DESC_MAGIC = 0xABCD5432;   // ESP-IDF esp_app_desc_t.magic_word
  var MIN_SIZE = 4096;

  function u32(b, o) {
    return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  }

  function ascii(b, o, n) {
    var s = "", i, c;
    for (i = 0; i < n; i++) {
      c = b[o + i];
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s.replace(/[\u0000-\u001f\u007f]+/g, "").trim();
  }

  /** 解析固件字节，返回 { ok, err, kind, offset, version, size } */
  function analyze(bytes) {
    var size = bytes ? bytes.length : 0;
    if (size < MIN_SIZE) {
      return { ok: false, err: "err_too_small", size: size };
    }

    var descAtApp = u32(bytes, 0x20) === APP_DESC_MAGIC;              // 应用固件
    var descAtMerged = size > 0x10040 && u32(bytes, 0x10020) === APP_DESC_MAGIC;
    var hasPartTable = size > 0x9000 && bytes[0x8000] === 0xAA && bytes[0x8001] === 0x50;
    var espImage = bytes[0] === 0xE9;                                  // 裸镜像头

    if (!descAtApp && !descAtMerged && !hasPartTable && !espImage) {
      return { ok: false, err: "err_not_esp", size: size };
    }

    if (descAtMerged || hasPartTable) {
      return {
        ok: true, kind: "merged", offset: 0x00000, size: size,
        version: descAtMerged ? ascii(bytes, 0x10030, 32) : ""
      };
    }
    return {
      ok: true, kind: "app", offset: 0x10000, size: size,
      version: descAtApp ? ascii(bytes, 0x30, 32) : ""
    };
  }

  /** 从回读的 flash 数据（起始地址 0x10020）解析版本 */
  function versionFromFlash(rd) {
    if (!rd || rd.length < 0x30) return "";
    if (u32(rd, 0) !== APP_DESC_MAGIC) return "";
    return ascii(rd, 0x10, 32);
  }

  /**
   * 从回读的 flash 数据（起始地址 0x10020，至少 0x70 字节）解析整条 app 描述符：
   * 0x00 magic / 0x10 version[32] / 0x30 project[32] / 0x50 time[16] / 0x60 date[16]
   * 设备上跑的固件能不能对上型号，全靠这几个字段。
   */
  function describeFlash(rd) {
    if (!rd || rd.length < 0x70) return null;
    if (u32(rd, 0) !== APP_DESC_MAGIC) return null;
    return {
      version: ascii(rd, 0x10, 32),
      project: ascii(rd, 0x30, 32),
      time: ascii(rd, 0x50, 16),
      date: ascii(rd, 0x60, 16)
    };
  }

  return {
    analyze: analyze,
    versionFromFlash: versionFromFlash,
    describeFlash: describeFlash,
    APP_DESC_MAGIC: APP_DESC_MAGIC
  };
})();
