# NOTICE — 第三方组件与许可

本工具（LinkRetro 网页版固件更新工具）使用了以下第三方成果，在此致谢。

## 运行期依赖

| 组件 | 版本 | 作者 / 维护者 | 许可 | 用途 |
|---|---|---|---|---|
| [esptool-js](https://github.com/espressif/esptool-js) | 0.7.0 | Espressif Systems | Apache License 2.0 | 浏览器内烧录 ESP32（@@vendor/esptool-js.js@@） |
| [pako](https://github.com/nodeca/pako) | 随 esptool-js 内联 | Andriy Golovnya 等 | MIT | 压缩传输，已内联进上者产物 |

## 上游固件项目

| 项目 | 作者 | 许可 | 说明 |
|---|---|---|---|
| [BlueRetro](https://github.com/darthcloud/BlueRetro) | **darthcloud** | Apache License 2.0 | 本产品基于其开源方案开发 |
| [Bluepad32](https://github.com/ricardoquesada/bluepad32) | **ricardoquesada** | 见上游仓库 | BlueRetro 的蓝牙协议栈基础 |

## 说明

- 本目录下的界面、状态机、镜像解析逻辑为本项目编写，采用 Apache License 2.0。
- @@vendor/@@ 下的代码版权归原作者，许可全文见 @@vendor/LICENSE.esptool-js@@；
  对该文件的唯一改动（ESM → 经典脚本）已在 @@vendor/README.md@@ 说明。
- 界面使用系统自带字体，未内嵌任何字体文件。
