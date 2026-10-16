# 数字针迹实验室与官方针法影像

日期：2026-10-16。基于 main `563f00a` 增量实现。入口：[针法与 AR 教学](https://yzou6525-ai.github.io/lihuaji/#ar)。

页面顺序为原 AR 绣境 → 数字针迹实验室 → 原基础练习 → 官方针法影像。首页、主导航、品牌字体/颜色、旧卡片/栅格、原 AR 文件与识别目标均未修改。知识手册原数据、1038份纹样、75件文创、故事译绣和学习记录保留。本阶段到基础设施为止，没有制作散套梨花56针作品。

## A. 修改文件

|文件|用途|
|---|---|
|`app.js`|原 #ar 追加两块内容；搜索追加官方资料；切页销毁实验室；浏览器恢复缓存页时重新挂载|
|`package.json`|原测试全部保留，追加针迹/影像测试|
|`scripts/build.mjs`|构建前验证针迹数据、知识关联和官方链接|
|`README.md`|本轮功能入口与说明|

## B. 新增文件

|文件|用途|
|---|---|
|`assets/stitch/StitchPlayer.js`|独立数据协议与播放状态，不依赖DOM或Three.js|
|`assets/stitch/StitchRenderer.js`|既有Three.js绘制、按进度更新和图形资源释放|
|`assets/stitch-lab.js`|挂载播放器、控件、异步载入、知识档案与错误提示|
|`assets/stitch-lab.css`|新模块作用域样式，继承原绢白馆藏主题|
|`assets/stitch-video-store.js`|来源校验、缓存、分词检索、影像卡片|
|`content/stitch-demos/demo-straight-basic.json`|直线针数字练习|
|`content/stitch-demos/demo-tao-basic.json`|套针数字练习|
|`content/stitch-demos/demo-gun-basic.json`|滚针数字练习|
|`content/stitch-video-sources.json`|六条官方外部来源|
|`scripts/create-stitch-demos.mjs`|可复现本项目自编坐标，不从视频提取针路|
|`scripts/validate-stitch.mjs`|构建数据校验|
|`scripts/stitch.test.cjs`|七组新自动测试|
|`scripts/stitch-acceptance.cjs`|浏览器验收与真实截图，可指定公网地址|
|`docs/stitch-lab/`|本文、来源清单、验收截图和报告|

## C. StitchPlayer 架构与数据协议

数据JSON → `validateStitchDemo` → `StitchPlayer`状态 → `StitchRenderer`几何 → 原页面控件。

播放器独立保存 position（连续数值，一单位等于一针）、speed、playing、showPoints。只有播放时申请一个 requestAnimationFrame；暂停、逐针、拖动、完成、离页即取消。每针默认演示时长750ms，属于播放器设置，不是实际工艺时间。长时间后台停留不会跳过整段练习。

接口：`loadStitchDemo(data)`、`play()`、`pause()`、`next()`、`previous()`、`seek(position)`、`setSpeed(speed)`、`setPoints(value)`、`restart()`、`dispose()`。上层通知由 onChange 接收；没有针法名称分支。

每套数据保留 `knowledgeId`、`nature: digital-practice-demo`、`expertReviewed: false`、`historicalReconstruction: false`。针迹包括唯一id、二维有限坐标start/end、连续order、group和可选十六进制color；当前坐标是无物理单位的示意坐标，y轴向上，只显示正面线段，不添加背面连线。必须为非零长度，最多10000针以限制内存。

未来接散套可增加独立JSON并在 `demoCatalogue` 中注册，`knowledgeId` 指向 `stitch-santao`；播放器和渲染器不用改写。单元测试只用临时fixture证明该ID可装载，**没有发布散套针序或最终作品**。知识定义通过原 `getSuxiuKnowledgeById` 读取，页面不复制一份文化定义。直线针仅关联平针作为相关阅读，不声称自编路径与官方记录一一等同。

## D–E. 示意数据与控制

|练习|针数|知识关联|
|---|---:|---|
|直线针|16|stitch-plain（平针相关阅读）|
|套针|24|stitch-tao|
|滚针|20|stitch-gun|

三套均为项目自编数字练习，并非专家逐针数据、传承人针路、标准针路或历史复原。页面持续显示指定真实性说明。

支持播放/暂停、前后逐针、连续拖动至任意进度、当前/总针数、0.5x/1x/1.5x、针落点开关、部分针段生长、回退隐藏后续针迹、完成后重新播放和独立重播按钮。原练习打卡仍保留。不需要相机，不读取手部或视频。

## F. Three.js 实现

复用 `assets/vendor/three/build/three.module.js`。所有丝线共用一个 BufferGeometry，每针两三角形（6顶点）组成轻量四边形，按drawRange控制已显示数量；当前针只更新末端坐标，回退/前进时恢复原顶点。颜色按顶点存储，共用一个材质。针落点单独一个Points几何。

64×32像素Canvas纹理由本项目数学公式实时生成，使用横向明暗和细纹形成轻微丝光；没有第三方纹理或封面下载。总计两份几何、一张纹理，不使用Tube/Cylinder、重shader、粒子或大型框架。像素比例上限1.5，正交相机按数据边界和容器宽高适配，暂停时仅交互/尺寸变化触发渲染。

## G–I. 官方影像与版权

共6条：4个视频入口、1门课程、1条非视频工艺延伸阅读。全部external，0个iframe。每条标题、机构、完整URL、可访问状态、核验边界见 [VIDEO-SOURCES.md](VIDEO-SOURCES.md)。

**没有下载、重新托管任何官方视频、m3u8、MP4、课程资源或第三方封面。** `downloaded=false`、`hostedLocally=false` 为全部条目的固定值。本次访问只读取公开页面/目录，浏览器核验时阻止媒体资源加载，不绕过平台限制。来源页面可访问并不等于完整视频播放已验证。

## J. 全局搜索

接入原顶部搜索，原知识、纹样、文创、练习结果不变，追加“官方影像与资料”分类。多个词采用全部命中，例如“苏绣 视频”。七个指定查询均通过：苏绣 视频、姚惠芬、套针、滚针、打籽、梅花、蒋雪英。主题只取本轮实际读取的官方标题/正文/公开课程大纲。

## K–M. 测试与截图

本地 Node 测试27/27通过（20组原测试、7组新增）。构建通过。浏览器使用Edge/Chromium；**390×844为模拟视口，不冒充实体手机验收**。

浏览器验收记录：[validation/report.json](validation/report.json)。原功能回归记录：[validation/regressions.json](validation/regressions.json)。

- 针迹：三套载入、播放/暂停/前后/重播、三档速度、0/中间/100%、部分针段、回退消失、针落点开关、知识跳转均通过。
- 资源：12次练习切换保持2 geometry/1 texture；3次播放中离页后，geometry/texture归零、RAF不再排队。ResizeObserver、IntersectionObserver、请求、事件及材质均释放。仅为有界测试，不承诺所有设备无限时长稳定。
- 故障：损坏JSON可选择其他练习恢复；图形模块失败显示提示，旧练习和影像仍可用；影像503可重试；慢加载离页不会重新挂回。
- AR回归：原十页手机视口、目标反复切换、缺图层降级通过。
- story回归：三候选、人工调整、实际SVG/CSV/过程文件下载、原MindAR真实示例匹配和五层故事绣境通过。
- library回归：1038目录、528张新增图实际解码、9地区筛选、来源注解、转稿与配对通过。
- suxiu回归：12查询在手册/全局各测一次、关联跳转、九工序、原商品与纹样搜索、离线已加载缓存、503恢复和快速切页通过。

真实运行截图（不是设计稿）：

1. [初始状态](validation/01-initial.png)
2. [中间进度](validation/02-mid-progress.png)
3. [针落点](validation/03-needle-points.png)
4. [套针示意](validation/04-tao.png)
5. [滚针示意](validation/05-gun.png)
6. [官方影像](validation/06-official-archive.png)
7. [390px手机视口](validation/07-mobile-390.png)

复现命令（测试工具需Node Playwright及Edge，网站访客无需安装）：

```sh
npm test
node scripts/build.mjs
node scripts/stitch-acceptance.cjs
node scripts/ar-site-regression.cjs
node scripts/story-acceptance.cjs
node scripts/library-acceptance.cjs
node scripts/suxiu-acceptance.cjs
```

本机未预装npm命令，已执行package.json相同Node测试清单；GitHub Actions以真正 `npm test` 再执行。验收脚本支持 `STITCH_TEST_URL`（末尾带 `/`）测试Pages，`STITCH_OUTPUT_DIR`指定报告目录。交付时另存公网验收和最终提交SHA，避免把自引用SHA写进提交本身。

## N–O. 开源研究与许可证（2026-10-16核验）

|项目|核对与用途|实际代码使用|
|---|---|---|
|[Bastidor](https://github.com/diogobernini/bastidor)|README明确逐针模拟、调速与scrubber；[LICENSE](https://github.com/diogobernini/bastidor/blob/main/LICENSE)为MIT|只参考交互思想，未复制代码、未引入Electron/字体/解析器|
|[Ink/Stitch](https://inkstitch.org/docs/visualize/)|参考Stitch Plan、Simulator、逐针控制、路径/针点表达；[LICENSE](https://github.com/inkstitch/inkstitch/blob/main/LICENSE)是GNU GPLv3|GPL代码未复制，未引入CLI或运行时|
|[manthrax/dst-format](https://github.com/manthrax/dst-format)|README说明Three.js纹理几何渲染；只研究轻量丝线、texture/progress概念。根目录未见LICENSE，GitHub license API返回404，无法确认授权|**未复制代码，仅参考技术概念**；未取其图片/纹理/DST文件|
|[PEmbroider](https://github.com/CreativeInquiry/PEmbroider)|程序刺绣研究参考|未复制代码、未引入Processing或runtime；未做许可证兼容性承诺|
|[p5.embroider](https://github.com/nkymut/p5.embroider)|程序化刺绣研究参考|未复制代码、未引入p5运行时或文件格式解析|
|MediaPipe Hand Landmarker|本阶段未引入、未做手部动捕|无|
|Three.js|复用现有本地vendor，MIT许可保留在`assets/vendor/three/LICENSE`|唯一直接使用的渲染库；没有新增运行时依赖|

新增播放器、渲染器、纹理公式和坐标由本项目实现；不宣称所有仓库素材都适用同一开源许可证。

## P. 限制与风险

- 所有针迹为二维表面数字示意，无真实针尖、手势、背面过线、张力、丝线实物参数或专家审定。不替代真实教学。
- CCTV《手艺中国》标题可核，动态正文/播放未确认，卡片明确提示。MOOC公开目录可核，但动态浏览器加载超时，选课/登录/播放仍按原平台要求；不得描述为全部视频可直接无条件播放。
- 外部链接可随原站变化；没有静默改接个人教程或第三方镜像。
- WebGL不可用时提示错误；旧练习与来源入口仍可阅读。无完整离线安装、后台、文件格式解析或摄像头能力扩展。
- 本轮不制作“散套针 × 梨花一瓣”，后续需另有可靠数据和独立任务。

## Q. 提交与发布

提交main后由既有Pages工作流校验/测试/发布。最后提交SHA、工作流结论及公网测试结果由交付目录 `release.json` 记录；以该记录及GitHub实际部署为准，不用预填成功状态。
