# 梨花季 AR 绣境 V2 交付说明

日期：2026-10-09。发布入口：https://yzou6525-ai.github.io/lihuaji/#ar

## 如何体验

1. 打开页面即可看到梨花依次浮起；拖动可转动查看空间层次。
2. 点击“用示例图片验证识别”，由 MindAR 对示例图片执行真实特征检测与匹配，再触发展开。此操作不使用摄像头。
3. “赏纹”显示完整构图；“解绣”将层距增大到 1.7 倍；“看针”可直接点选花瓣、叶片，或点击下方图层名称。点画面空白处取消选中。
4. “收拢”恢复同一平面，再点“展开”重放。右上角可选择原眼罩、莲花目标，保留原单图绣框和针线示意。
5. 展开“查看与下载识别卡”，下载梨花卡，打印或在另一台设备上显示。在 HTTPS 页面同意本次使用相机后，点击“开启摄像头扫描”，对准完整卡片。不要尝试扫描正在显示同一页面的手机本身。
6. 关闭摄像头、撤销同意或离开页面后会停止媒体轨道。画面在浏览器内处理，不上传、不自动保存。WebXR 平面放置仅在浏览器和设备报告支持时启用。

## 本次实现

- 六张像素对齐的 1024×1024 RGBA PNG：底稿、枝干、叶片、后层花瓣、前层花瓣、花蕊，同时提供可编辑 SVG 源文件和重建脚本。
- 所有层初始局部 Z 为 0。默认引擎层距 0.012；梨花配置为 0.03，顶部深度 0.15，解绣顶部深度 0.255，以获得克制但可见的视差。
- 125ms 逐层延迟、680ms 弹出、EaseOutBack、0.93→1.035→1 缩放、固定的轻微转动和 0.2→1 透明度；320ms 收拢。减少动态效果偏好下直接显示终态。
- SEARCHING → FOUND → PLAYING → ACTIVE；连续丢失约 700ms 后进入 LOST 并收拢。连续矩阵更新不重放，恢复识别才重新展开。
- Raycaster 配合透明像素遮罩点选；被选层保持不透明并略向外移动，其他层透明度 0.15。遮罩仅保存 alpha 通道以减少内存占用。
- 单层资源失败时跳过，全部失败时回退原单图预览；图层纹理、材质、几何及时释放。像素比例不超过 1.5。
- 保留预览、实际示例匹配、摄像头跟踪、WebXR 放置、父页面授权通信、隐私说明和学习记录。嵌入页面随内容高度变化，手机可阅读工艺卡片。
- 相机权限拒绝返回可用预览；等待系统授权期间撤回同意，迟到的媒体流也会立即关闭。

## 数据与真实性

梨花是 AI 辅助编写 SVG 后生成的原创构图素材，不是传统纹样复原、馆藏扫描或真实绣品照片。图层顺序是视觉构图顺序，不能理解为实际绣制顺序。`stitch`、`threadColor`、`productionOrder` 尚无真实来源，界面显示“资料待补充”；没有编造针法与色号。原目标保留原出处。

`targets.json` 中新增梨花，原两个目标索引不变。`targets.mind` 由同一版本的 MindAR Compiler 从三张实际识别图重新编译。下载卡与目标图一致。只修改显示图层不必重编识别库；修改识别卡或目标顺序则必须重新编译。

底层使用现有 [MindAR](https://github.com/hiukim/mind-ar-js) 和 [Three.js](https://github.com/mrdoob/three.js)，原许可保留在 vendor 中。阅读了 [2.5D 分层参考项目](https://github.com/JudyZZ/threejs-parallax-skill) 的方法说明，本次未复制其代码或素材；新增分层、动画、交互模块由 AI 助手按本项目要求编写，未经人工苏绣专家审核。

## 修改文件清单

| 路径 | 用途 |
| --- | --- |
| `app.js` | AR 页面入口文案、可信 iframe 消息、动态高度 |
| `assets/ar-experience.html/css/js` | 完整 AR 页面、样式、相机和模式交互 |
| `assets/ar/Tween.js` | 可取消、可测试的轻量动画 |
| `assets/ar/TrackingState.js` | 丢失宽限、播放状态 |
| `assets/ar/LayeredPattern.js` | 分层加载、展开收拢、拾取和释放 |
| `assets/ar/CraftOverlay.js` | 工艺信息展示与未知数据处理 |
| `assets/ar-assets/targets.json/mind` | 三个目标配置与编译后的特征库 |
| `assets/ar-assets/layers/pear-blossom/` | 六层 PNG、SVG 与素材说明 |
| `assets/ar-assets/markers/pear-blossom.png` | 识别卡 |
| `scripts/create-pear-layers.cjs` | 从原创矢量构图生成各层和识别卡 |
| `scripts/compile-ar-targets.cjs` | 在浏览器用现有 MindAR 编译三个目标 |
| `scripts/ar-local-server.cjs` | 测试专用临时静态服务器，不发布、不供访客使用 |
| `scripts/ar-state.test.cjs` | 时间边界与动画取消测试 |
| `scripts/ar-acceptance.cjs` | 浏览器交互与真实特征匹配验收 |
| `scripts/ar-site-regression.cjs` | 原页面回归、资源释放与缺图层测试 |
| `scripts/build.mjs` | 构建时检查图层存在、尺寸和相对路径 |
| `.github/workflows/pages.yml` | 发布前执行纯 Node 状态测试 |
| `README.md`、`docs/AR-LAYERED.md` | 使用与交付说明 |

## 验收证据与边界

浏览器验收使用 Windows 上的 Edge / Chromium，移动端尺寸为 390×844。相机测试使用包含真实识别卡的 Canvas 媒体流，运行实际 MindAR 检测、匹配、追踪，没有伪造识别回调。状态测试另行验证 700ms 边界、短丢失不重放，以及动画取消和结束值。

机器测试结果见 `docs/ar-validation/report.json` 与 `site-regression.json`；截图为实际浏览器输出。多次展开后 Three.js 几何与纹理计数未增长；多次切换后最多保留一张旧目标纹理。这不是无限时长内存稳定性证明，也不是所有低端手机性能保证。

**Android Chrome 物理相机、iPhone Safari 物理相机、真实手机移动视差、WebXR 桌面放置均未真机验证。** 不将桌面移动尺寸或合成视频测试写成手机通过。手机设备若不支持 WebGL、媒体权限或 WebXR，使用预览或示例识别入口；WebGL 不可用时显示明确提示。

## 复现与发布

访客无需安装软件。开发者基础验证：

```sh
node --test scripts/ar-state.test.cjs
node scripts/build.mjs
```

完整浏览器验证需要可用的 Node Playwright 包及 Edge（测试脚本使用 `channel: 'msedge'`），运行：

```sh
node scripts/ar-acceptance.cjs
node scripts/ar-site-regression.cjs
```

只有重建图片才需要 Node Sharp：`node scripts/create-pear-layers.cjs`。只有识别卡更新才需 `node scripts/compile-ar-targets.cjs`。这些是开发工具依赖，不是网站运行依赖。所有浏览器资源随站点托管，无 CDN。

提交 main 自动触发 GitHub Pages。工作流先构建和测试，通过后发布 `_site`。网站仍为静态文化展示，不新增后台交易、订单、登录或服务端 AI；源电脑关机不会停止 GitHub 托管。
