# 数字针迹实验室与官方针法影像

日期：2026-10-16。基于 main `563f00a` 增量实现。入口：[针法与 AR 教学](https://yzou6525-ai.github.io/lihuaji/#ar)。

页面顺序为原 AR 绣境 → 数字针迹实验室 → 原基础练习 → 官方针法影像。首页、主导航、品牌字体/颜色、旧卡片/栅格、原 AR 文件与识别目标均未修改。知识手册原数据、1038份纹样、75件文创、故事译绣和学习记录保留。A–Q为基础设施初版记录；新增56针数据原型见文末“散套针 · 梨花瓣数字示意 V0”。

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

初版使用临时fixture验证未来散套数据接入；本轮已按同一协议增加独立JSON和目录注册，详见文末。知识定义通过原 `getSuxiuKnowledgeById` 读取，页面不复制一份文化定义。直线针仅关联平针作为相关阅读，不声称自编路径与官方记录一一等同。

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
- 基础设施初版未制作“散套针 × 梨花一瓣”；后续V0仅加入项目数字坐标原型，不能据此升级为专家或历史工艺数据。

## Q. 提交与发布

提交main后由既有Pages工作流校验/测试/发布。最后提交SHA、工作流结论及公网测试结果由交付目录 `release.json` 记录；以该记录及GitHub实际部署为准，不用预填成功状态。

## 散套针 · 梨花瓣数字示意 V0

2026-10-16，基于 main `6fcedef280b0984a788631958a315b2b95bc2ecb` 增量实现。仅新增第四套针迹数据并复用现有播放器；无新运行时依赖。查看现有 `#ar` 页面“数字针迹实验室”，选择第四项。

### A–D. 版本、文件与针数

发布提交SHA与公网验收写入交付目录 `release.json` 和《交付报告》，避免自引用SHA。原三套分别16、24、20针，原JSON未变。

|类型|文件|变更|
|---|---|---|
|新增|`content/stitch-demos/demo-santao-pear-petal.json`|56针坐标、知识ID、真实性说明、数字设计参数|
|新增|`scripts/santao-petal-data.mjs`|可复现纯函数生成器，固定seed 5602814|
|修改|`scripts/create-stitch-demos.mjs`|调用新生成器；原三套生成规则不变|
|修改|`assets/stitch-lab.js`、`assets/stitch-lab.css`|第四个选项、小批次标签、专属说明；标签窄屏可换行|
|修改|`assets/stitch/StitchPlayer.js`|允许新nature，校验可选线宽；播放状态机不变|
|修改|`assets/stitch/StitchRenderer.js`|读取可选数字线宽比例，旧数据默认仍为0.006；无第二套渲染器|
|修改|`scripts/validate-stitch.mjs`、`scripts/stitch.test.cjs`、`scripts/stitch-acceptance.cjs`|数据、数字结构、控件、资源和截图验收|
|新增/更新|本说明及`validation/08`至`12`截图、结构/回归/浏览器报告|可复核结果|

|批次|order|数量|显示标签|
|---|---|---:|---|
|1|1–28|28|第一批 · 出边|
|2|29–42|14|第二批 · 套入|
|3|43–56|14|第三批 · 相嵌|

总数严格为56。零进度显示第一批准备状态；28.1按正在绘制的第29针显示第二批，42.1对应第三批；回退标签随之回退。

### E. 生成与视觉调整

固定种子的整数伪随机序列控制微小扰动；非 `Math.random()`。外缘采用宽冠、略不对称的参数曲线，28个顺序位置有非等距扰动；内部终点的长度和方向独立变化。第二批在第一批每对相邻针之间起始，起点位于其路径内部，再向较深处延伸。第三批从已有第二批段内偏移起始，在基部不同高度收束。最后整体轻微倾斜，形成原创单瓣形态。全部点保留三位小数，范围x∈[-50,50]、y∈[-55,60]，无物理单位。

所有数字参数都是项目设计：0.38–0.57的第二批入口插值、第三批入口、基部端点修正、0.23弧度倾斜、0.028线宽比例及暖白配色均不是传统工艺标准。未从官方视频提取或临摹逐针轨迹。

真实截图检查曾发现：初稿狭长、下部斜向空隙突出；放宽后基部过于齐整；环绕式尝试又形成放射扇面。最终保留宽冠，将外侧针长压入单瓣区域，后两批起点安排在旧针段内，扩大基部端点的横向及纵向差异，并降低配色对比。只改坐标和数字线宽，没有添加填充底图掩盖空隙。最终仍是可辨认线段的V0结构原型，保留少量缝隙供逐针审阅。

### F–G. 官方字段与项目设计边界

`knowledgeId: stitch-santao`，使用原 `getSuxiuKnowledgeById` 获取 `title`、`summary`，并链接完整档案的 `facts`、`sourceIds`、`evidenceLevel`、`scope`、`relations` 与审核说明。本轮未修改两份知识/来源JSON。

原facts支持“线条错落相嵌、由外向内绣制、可表现花卉树石翎毛”及“散套属于套针分型”，来源为故宫博物院[散套针](https://www.dpm.org.cn/lemmas/245175.html)与[套针](https://www.dpm.org.cn/lemmas/239950.html)。知识范围是传统刺绣一般知识，不能据此声称本瓣的精确苏绣针路获官方认可。

梨花瓣作为《梨花季》的原创数字示意载体。**造型、56针及28/14/14分批、所有坐标/针序/线宽/配色/倾斜/重叠阈值均为项目数字示意规则。不是历史复原、不是标准针数、不是专家逐针数据。** 页面显示完整真实性说明以及“批次颜色与高亮仅用于数字结构区分，不代表真实苏绣丝线配色”。当前没有新增金色当前针高亮，仅复用已有逐针生长。

### H–K. 验收

真实浏览器截图：

- [第28针：第一批](validation/08-santao-batch1.png)
- [第42针：套入](validation/09-santao-batch2.png)
- [第56针：相嵌](validation/10-santao-batch3.png)
- [112个针落点](validation/11-santao-points.png)
- [390×844移动视口](validation/12-santao-mobile.png)

结构报告：[santao-structure.json](validation/santao-structure.json)。数字检查包含56/28/14/14、ID/order、有限且不重合的坐标、画布范围、元数据；第一批长度和端点深度跨度；新针前20%采样须贴近旧针**内部**（不是仅碰端点）；连通性及上宽下窄。后两批均14/14满足当前数字重叠阈值。阈值只防数据退化，不证明真实工艺。

自动测试新增4组，原27组全部保留，总计31组。含故意整齐端点、脱离旧区域、越界、伪造真实性等反例；生成器重复调用与已提交JSON完全一致。运行命令仍见上文。构建校验已接入原构建脚本。

本地[浏览器报告](validation/report.json)：原三套与56针全部控件通过；28/42/56及小数边界、针落点、真实知识跳转、16次切换资源稳定、离页释放、故障恢复通过。390×844下无横向溢出，按钮/进度条/速度/针落点可操作；这是桌面浏览器移动视口，不等于真机测试。

本轮[原功能回归](validation/santao-regressions.json)：AR十页和既有资源/降级，story候选/下载/原MindAR目标，library 1038条及528张图片解码，苏绣手册12查询/关系/九工序/全局搜索/故障恢复均通过。AR相关文件、首页、导航、全局视觉和官方事实没有改动。

### L–M. 人工视检与限制

已逐张查看28、42、56针、针落点及390px截图，并据上述问题迭代坐标。当前可见第一批不齐内缘、后两批在原组织内部增加针段、最终上宽下窄的单瓣轮廓。最终审美与工艺判断仍由用户及后续专家审核，不能用自动测试代替。

当前用直线四边形表达表面丝线，局部间隙和几何感仍在；没有真实丝线的柔软、张力、圆弧、背面过线或物理光照。没有历史作品或专家逐针标注可比对，不能称为真实/标准梨花绣法。本轮止于数据原型，不追加针模型、11秒动画、纹理融合、摄像头或AR接入。复用Three.js及原MIT许可，无新增第三方代码或素材。
