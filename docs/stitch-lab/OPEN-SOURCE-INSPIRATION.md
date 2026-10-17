# Stitch Lab 开源参考与代码边界

核对日期：2026-10-17。下列项目仅作为交互或技术概念参考；Stitch Lab V4 的几何、手势、相机状态和 UI 均在梨花季现有架构内独立实现。

| 项目 | 可核对的参考 | 许可证状态 | 本项目使用 |
|---|---|---|---|
| [Bastidor](https://github.com/diogobernini/bastidor) | README 列出画布 zoom/pan、逐针模拟和进度 scrubber。 | 仓库当前列出 MIT；[许可证文件](https://github.com/diogobernini/bastidor/blob/main/LICENSE)。 | 只参考操作方式。Copied code: None。未引入 Electron、其 renderer、UI、格式解析器、字体或素材。 |
| [Ink/Stitch Simulator](https://inkstitch.org/docs/visualize/) | 参考 Stitch Plan、针落点、逐针播放和缩放/平移阅读。 | [仓库 LICENSE](https://github.com/inkstitch/inkstitch/blob/main/LICENSE) 为 GNU GPL-3.0。 | 只参考功能概念。Copied code: None。没有复制 GPL 源码，也没有引入 Ink/Stitch CLI/runtime。 |
| [manthrax/dst-format](https://github.com/manthrax/dst-format) | 只参考 Three.js 纹理针迹几何与 draw range 的概念。 | 截至核对日期，GitHub 仓库页没有声明许可证，故不能据此确认复制或再分发授权。 | 没有安装、导入或复制代码、图片、纹理、DST 文件。dst-format copied code: None。 |

Stitch Lab 继续使用仓库内已有的 Three.js vendor。V4 未新增第三方运行时依赖。
