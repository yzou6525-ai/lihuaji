# 散套针 · 梨花一瓣数字显影 AR V2

基于 `7abab4c37a0712790e944a2c5bef3a509f6db038` 的网页 V1，增量接入现有 AR 绣境。仅接入梨花前层花瓣；首页、导航、纹样库、知识事实及原三张识别目标不变。

## 使用

在原 AR 绣境选择梨花，进入“看针”。点击金色圆环内的目标花瓣，或者点击“前层花瓣”列表项，然后点“显影散套针”。3D 预览、示例图片匹配、摄像头扫描共用该入口。眼罩、莲花和自定义故事纹样没有散套入口。

显影可暂停、继续、拖动 0–11 秒进度、重播或退出。11 秒后显示简短知识卡，可查看 `#guide/stitch-santao`。控件位于 stage 下方，不在花瓣中央覆盖文字。进入/退出不改变 stage 高度。相机仍需用户同意，数据留在浏览器；没有新增云服务。

## 共享核心与宿主

```text
同一 demo-santao-pear-petal.json
           ↓
同一 SantaoTimeline（internal / manual）
           ↓
同一 SantaoVisual + StitchSurface
           ↓
SantaoExperience          SantaoARAdapter
原 Stitch Lab            原 anchor → content
```

`StitchSurface` 从原 `StitchRenderer` 提取丝线纹理、三角形针迹缓冲和 segment 更新逻辑，不创建 WebGLRenderer、Scene 或渲染循环。`SantaoVisual` 从原 `SantaoExperience` 提取完成面、针杆/针尖、12 段 Bézier ribbon 及丝线状态更新。网页与 AR 使用同一份针模型、松线/拉紧、分批显影逻辑。

`SantaoExperience` 保留网页宿主的相机和自主时钟处理。`SantaoARAdapter` 使用 `clockMode: manual`，由原 `renderer.setAnimationLoop(animate)` 调用 `update(t)`；自身不运行 RAF、不渲染场景、不建立第二个 WebGL canvas。生成丝线/完成面用的离屏 Canvas 仅用于纹理，不是第二个显示画布。

针尖裁剪平面随整个 Group 的世界矩阵变换，识别卡旋转/移动时仍以绣面为出入针边界。未修改 MindAR 相机 projectionMatrix、扫描 FOV、getUserMedia 参数或 Controller 的特征匹配实现。

## 数据锁定

- 同一 56 针，批次仍是 28/14/14。
- 同一代表针：1、32、46。
- 同一 11 秒时间轴，详细分段见 [V1 说明](../stitch-lab/README.md)。
- 同一知识 ID：`stitch-santao`，知识卡从现有已核验知识库读取摘要，保留完整档案链接。
- 未修改、未重生成针迹 JSON。统一 LF 后 SHA-256：`92af2e12212dd652767d79b8f758ca3da314dab02ac1f942345e9bf1d0fa1d31`。
- **未修改、未编译 targets.mind**。原始二进制 SHA-256：`4f1d11dcc9d3b07dbe66092f7e94e4ab2b04595eba0310b898f621ab3875c1b8`。
- 原识别卡、六层 PNG/SVG 与 target index 不变。

## 花瓣定位

实际查看原 `layer_04_petals_front.png`、原 SVG 生成参数与浏览器画面后，选择左上方最大花朵朝左的前层花瓣。该花朵在 1024×1024 原图中的中心约 (431,337)，目标瓣中心约 (365,332)，远离主要花蕊遮挡。

元数据在 `assets/ar-assets/targets.json` 的 pear-blossom.craftExperiences：

|参数|值|
|---|---|
|layerIndex|4（以原定义索引定位，缺其他层时不会错绑）|
|hotspot.u|0.3564453125|
|hotspot.v|0.67578125，Three.js UV 向上|
|hotspot.radius|0.055|
|transform.x|-0.1435546875|
|transform.y|0.17578125|
|transform.z|相对于当前前层花瓣 +0.006|
|transform.scale|0.00155，整体均匀缩放|
|transform.rotationZ|1.6964600329 弧度|

先减去针迹包围盒中心，再整体缩放/旋转/平移，不改每针坐标。通常在展开并选中前层瓣时，实际 Z 为 `0.12×1.7+0.018+0.006 = 0.228`。若当前图层位置不同，使用其实际 Z 加微小偏移。

挂载树：`scene → anchor → content → santaoARGroup → normalized → {StitchSurface, SantaoVisual}`，与 `LayeredPattern.group` 同级。自动继承原识别矩阵、位置、旋转和缩放。热点使用现有 Raycaster 的透明像素拾取，再检测 UV 距离；新增 `pickDetailed`，旧 `pick()` 仍返回原索引。

## 状态、追踪与清理

进入前保存每层 visible、opacity、position、scale、rotation，以及 selected、expanded、amount；停止尚未结束的层动画，冻结当前视觉快照。显影时目标层 opacity 0.10，其余 0.08；原图层仍留在场景中。AR 丝线仅增加显示对比，不更改原数据配色。退出逐项恢复，不重新加载纹理。

沿用原 TrackingState 的 700ms grace。确认丢失时记录 `pausedByTracking = timeline.playing`，暂停时间轴并隐藏知识卡，随原 anchor 延迟隐藏；不重置、不销毁针迹。重新找到同一目标时，只有 `pausedByTracking` 才自动继续；原手动暂停维持暂停。显影期间不重播原分层展开，避免打乱已冻结的层位置。

切换目标、视图、Preview/Sample/Scan、关闭相机、离页时退出显影并释放其资源；页面隐藏时暂停。播放期间禁用图层选择、展开按钮和旋转拖动，仍可用显影控件及切换视图退出。加载失败不会影响原 AR，显示可继续赏纹、解绣或看档案的提示。

AR 实例拥有 7 个几何（含未显示的针落点缓冲）、6 个材质、2 张纹理。已渲染资源新增 6 个几何/2 张纹理；退出全部 dispose，未误释放原六层纹理。10 次进出未出现增长。原 V1 借用纹理仍由网页宿主释放。

## 浏览器证据

|文件|场景|
|---|---|
|[01-preview-craft.png](validation/01-preview-craft.png)|预览看针、前层花瓣选中|
|[02-preview-batch1.png](validation/02-preview-batch1.png)|3.5 秒|
|[03-preview-batch2.png](validation/03-preview-batch2.png)|5.2 秒套入|
|[04-preview-batch3.png](validation/04-preview-batch3.png)|7.8 秒|
|[05-preview-complete.png](validation/05-preview-complete.png)|11 秒与知识卡|
|[06-sample-tracked.png](validation/06-sample-tracked.png)|真实 MindAR 示例图片匹配|
|[07-mobile-390.png](validation/07-mobile-390.png)|390×844 浏览器视口|
|[08-tracking-lost-state.png](validation/08-tracking-lost-state.png)|**合成 Canvas 媒体流**移除识别卡，经过实际 MindAR 算法后丢失；不是物理相机截图|

实际视检后将整体比例从 0.00135 调到 0.00155，提高丝线对比并降低背景权重。针迹贴在所选瓣上，没把整朵花当成一个瓣，也未改针路或强行放大为雕塑。小屏中细节受目标投影面积限制，实际相机中需让识别卡适当占据画面；实体设备的可读性仍需用户验收。

## 测试

```sh
npm test
node scripts/build.mjs
node scripts/ar-santao-acceptance.cjs
node scripts/ar-acceptance.cjs
node scripts/ar-site-regression.cjs
node scripts/santao-cinematic-acceptance.cjs
node scripts/stitch-acceptance.cjs
node scripts/story-acceptance.cjs
node scripts/library-acceptance.cjs
node scripts/suxiu-acceptance.cjs
```

新增 4 项状态/架构测试，旧 36 项保留。内部与手动时钟在整段 11 秒逐帧状态一致；原针迹与识别库哈希锁定；自动/手动暂停区分；每层属性精确恢复。浏览器测试覆盖实际点击热点、列表入口、完整播放、10 次资源释放、真实示例匹配、合成卡片移动追踪、丢失/重现、相机关闭、加载失败、窄屏及自定义纹样隔离。

旧知识底座测试曾冻结全部 AR 文件，本次按用户明确的 AR 更新范围只更新 6 个文件的预期哈希，保留上一哈希与原因；其余原始文件继续严格比对，未删除测试。最终结果看 [验收记录](validation/report.json) 及 [回归汇总](validation/regressions.json)。公网验收在发布后单独保存，未以本地测试冒充。

浏览器验收需要 Node Playwright 与 Edge。`AR_SANTAO_TEST_URL` 可指定以 `/` 结尾的 Pages 根地址；`AR_SANTAO_OUTPUT_DIR` 可指定输出路径。公网测试不注入合成相机或故障；本地执行这些专项验证。

## 边界与停止范围

`realPhoneARVerified: false`

`realCameraTrackingVerified: false`

Preview、真实 Sample MindAR、合成媒体流追踪及移动视口验证不等于实体手机相机测试；WebXR 平面放置也未真机验证。针尖高度、56 针、配色高亮与动画都是数字设计，不是专家逐针数据、MoCap 或历史复原。保留完整真实性提示。没有新增针法、配乐、手势、后台、账号、云服务或首页设计。本轮结束后停止，等待实体手机验收。

运行时只复用原 Three.js/MindAR，沿用仓库内许可证。未增加第三方代码、外部模型或新识别图。
