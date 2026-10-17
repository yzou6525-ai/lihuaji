# 第三方组件与许可证

以下说明仅列当前项目实际打包或接入的工具，以及本轮任务中提及但没有导入的工具。工具是否可用、许可证声明与项目是否复制代码分开说明。

| 项目 | 许可证 / 当前状态 | 梨花季使用方式 | 复制代码 |
|---|---|---|---|
| Three.js | MIT；随项目提供的 `assets/vendor/three/LICENSE` | 本地打包模块，用于 AR 与 Stitch Lab 的 3D 渲染 | 有，使用本地发行文件；保留随附许可证 |
| Bastidor | 提案所列 MIT；当前仓库未发现该项目依赖或代码 | 未使用 | None |
| Ink/Stitch | 提案所列 GPL-3.0；当前仓库未发现该项目依赖或代码 | 未使用，仅此前方案参考 | None |
| `manthrax/dst-format` | 许可证未确认；当前仓库未发现依赖或代码 | 未使用 | None |
| Ricuci / `Federicokalik/embroidery-converter-kit` | `content/digital-tools.json` 登记为 MIT；官方工具页/仓库链接见该数据 | iframe 接入 `https://ricuci.app/convert/`；实际文件转换由 Ricuci 提供 | None |

Ricuci 的公开仓库许可登记和线上工具服务是两个不同对象。此处不把梨花季的界面或针迹示意声明为 Ricuci 代码。依赖清单以当前仓库文件和已登记信息为准，不代表对第三方服务持续可用性的保证。
