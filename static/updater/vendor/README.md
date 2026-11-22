# vendor/ — 第三方依赖

本目录的代码**不是本项目编写**，来源与许可如下。

## esptool-js.js

| 项 | 值 |
|---|---|
| 项目 | [esptool-js](https://github.com/espressif/esptool-js)（Espressif Systems） |
| 版本 | 0.7.0 |
| 上游产物 | `https://unpkg.com/esptool-js@0.7.0/bundle.js` |
| 许可 | Apache License 2.0（全文见 `LICENSE.esptool-js`） |
| 是否修改 | **是**，仅一处（见下） |

### 修改说明

上游 `bundle.js` 是 ES Module，文件结尾是一条 `export{...}` 语句。
在 `file://` 协议下，浏览器会以 CORS 为由拒绝加载 ES module，而本工具需要支持
"双击 HTML 直接打开"（不装服务器、不装运行时）。

因此转换时**只做了这一处改动**：把结尾的

`export{A as B, C as D, ...}`

改成

`window.esptooljs = (function(){ ...原文... return {B:A, D:C, ...}; })();`

其余代码逐字节保持一致。重新生成：

`python web/build-vendor.py`
