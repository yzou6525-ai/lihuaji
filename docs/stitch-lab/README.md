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

## 散套针 · 梨花一瓣数字显影 V1

2026-10-17，基于 `6608f3322598e748f87d46c157f89f98c287b11b` 增量实现。在原“数字针迹实验室”选择散套练习后，点击“播放数字显影”。首页、导航、其他练习及 AR 追踪保持原样。本节描述 V1，前述 V0 的阶段限制保留为版本记录。

### 文件与架构

新增 `assets/stitch/SantaoExperience.js`、`assets/stitch/SantaoTimeline.js`、`scripts/santao-cinematic.test.cjs`、`scripts/santao-cinematic-acceptance.cjs`；修改 `assets/stitch-lab.js`、`assets/stitch-lab.css`、`package.json` 及本说明。新截图与测试记录位于 `validation/13` 至 `21`、`cinematic-report.json`、`cinematic-regressions.json`。无新增第三方依赖，继续使用现有 Three.js 与其 MIT 许可证。

`SantaoExperience` 借用原 renderer、相机和丝线纹理，拥有一个独立展示 Group。包含完成面、轮廓、针杆/针尖和动态丝线。显影期间原播放器暂停，只有显影更新场景；退出后恢复普通线宽、颜色、透明度、相机与裁剪配置。没有第二个 renderer 或 canvas。

`SantaoTimeline` 将时间映射为纯状态，可从任意时间重建画面，不依赖累积播放。控制 start/pause/resume/seek/restart/dispose，只有一个 requestAnimationFrame。切换练习、离页、页面隐藏及离开视口均处理暂停或销毁；慢加载后离页不会重新挂载。减少动态偏好下先暂停，用户可主动播放。

### 56 针与代表针

**未修改或重新生成基础 56 针数据**，仍为 28/14/14。JSON 统一 LF 后 SHA-256：`92af2e12212dd652767d79b8f758ca3da314dab02ac1f942345e9bf1d0fa1d31`，自动测试固定验证。

代表针实际 order 为 **1、32、46**。第二、三批选用同批内稍靠内部的针，使“套入”发生在可见的旧丝线组织内部；没有改变坐标、数据 order 或普通逐针顺序。显影只先展示该代表针，再填入同批其余针，其他 53 针各出现一次。每批最终仍严格 28、14、14。

针杆为八面圆柱，针尖为八面圆锥，总长度 12 个示意坐标单位；用浅灰无金属高光材质及表面裁剪表达出入针。每条重点针均包含出针、抬针、行针、入针、拉线。高度、动作、角度及时间为数字设计，**不是 MoCap、历史复原或专家逐针数据**。

松弛丝线使用二次 Bézier，控制点带少量侧向弯曲和高度。沿曲线采样为 12 段动态三角形 ribbon，复用普通模式丝线纹理；拉线时控制点回到两端中点，收紧为表面针迹。没有绳索物理，也没有重型 TubeGeometry。完成面由现有针迹方向生成原创细纤维纹理，开始自然淡出，结尾自然淡回，不冒充真实作品照片。

### 11 秒实际时间轴

|秒|阶段|
|---|---|
|0–1|完整梨花瓣完成面|
|1–2|完成面淡出，保留轮廓|
|2–3.2|第 1 针完整动作|
|3.2–4.5|补齐第一批 28 针|
|4.5–5.8|第 32 针套入，轻微放大|
|5.8–7|补齐第二批，累计 42 针|
|7–8|第 46 针相嵌|
|8–9|补齐第三批，累计 56 针|
|9–10.2|针迹与完成面融合|
|10.2–11|完整梨花瓣与收束文字|

独立进度条支持 0–11 秒回看；暂停、继续、重播、返回逐针均可用。结束后恢复普通控件，操作普通控件会先销毁显影。

### 浏览器截图与视检修正

实际浏览器截图：[开始](validation/13-santao-intro.png)、[第一批](validation/14-santao-batch1-action.png)、[第二批约 5 秒](validation/15-santao-batch2-action.png)、[第三批](validation/16-santao-batch3-action.png)、[融合](validation/17-santao-merge.png)、[完成](validation/18-santao-complete.png)、[390×844](validation/19-santao-cinematic-mobile.png)、[松线](validation/20-santao-thread-slack.png)、[收紧](validation/21-santao-thread-tight.png)。

逐张视检后：将第二、三条代表针从外侧移至同批内部；降低旧线对比、减细显影线宽并增加第二批轻微放大；修正针模型可能超出相机范围的问题；把字幕放在画布下方，收起重复说明，保留完整真实性提示；修复截图读取进度条后未等待绘制造成的视觉不同步。普通模式样式与基础数据不变。

### 测试与资源

运行 `npm test`、`node scripts/build.mjs`；浏览器运行 `node scripts/santao-cinematic-acceptance.cjs`。设置 `SANTAO_TEST_URL` 为末尾带 `/` 的站点根地址可验收公网；`SANTAO_OUTPUT_DIR` 指定输出目录。需要 Playwright 和 Edge。原有 `stitch-acceptance.cjs`、`ar-site-regression.cjs`、`story-acceptance.cjs`、`library-acceptance.cjs`、`suxiu-acceptance.cjs` 均保留。

本地 36 项自动测试通过，构建通过，完整播放实测 11061ms。新浏览器验收涵盖时间回退、暂停/继续、完整播放、重播、普通控件恢复、模块加载失败、慢加载离页、图形上下文丢失、减少动态偏好及移动视口。报告见 [显影验收](validation/cinematic-report.json) 和 [原功能回归](validation/cinematic-regressions.json)。公网结果在发布后独立记录，不用本地结果冒充。

5 次进入/退出：WebGL 几何/纹理从普通 2/1 到显影 7/2，退出均回到 2/1；离页为 0/0。显影自有 5 个几何、4 个材质、1 张纹理全部释放，借用的原丝线纹理不销毁。退出后 RAF 取消。

原四套逐针、知识跳转、故事译绣及 SVG/CSV 下载、1038 条纹样库与 528 张新增图片解码、知识手册搜索/来源、原 AR 页面与识别目标回归通过。

### 边界

本版是二维针迹基础上的数字工艺展示，局部线条仍有程序几何感；不模拟实物张力、手势、背面过线或真实布料形变。390×844 是浏览器视口测试，未等同于实体手机性能验证。WebGL 丢失时提示重新进入页面，不声称自动恢复图形上下文。**本轮没有修改 MindAR / AR tracking，没有接入摄像头或开始下一阶段。**

## 数字刺绣阅读能力 V4

日期：2026-10-17。此轮只扩展现有 Stitch Lab 的完整针迹计划与画布阅读操作，不增加针法、页面或 renderer。

### Stitch Plan

“显示完整针迹计划”默认关闭，与速度、针落点选项同组。加载练习时建立一份独立的完整计划 BufferGeometry；颜色属性含逐顶点 alpha，未完成针迹使用共享丝线 CanvasTexture 和 0.14 的低透明度，已完成针迹透明度归零。播放主 mesh 继续通过原 drawRange 和当前 partial segment 显示；计划 mesh 不共享其 drawRange。针落点仍只属于真实播放进度。开关只切换 mesh.visible，不创建或释放几何，也不修改播放器状态。

### Zoom、Pan 与 Fit

StitchRenderer 仍使用原来的单一 WebGLRenderer、canvas、scene 和 OrthographicCamera。视图状态集中保存在 renderer：`zoom` 限制在 0.8–5，`panX` / `panY` 使用数据坐标；滚轮与双指缩放根据指针或两指中点锚定画面，鼠标/单指拖动画布平移。“适合画布”会依据当前数据 bounds 恢复 `zoom=1, panX=0, panY=0`，不改变播放进度。画布双击也可 Fit。切换练习后自动 Fit；窗口尺寸变化仅更新正交 frustum，保留用户当前 zoom 与 pan。

触摸手势通过局部 Pointer Events 实现。`touch-action:none` 只应用于针迹 canvas；canvas 外的页面滚动保持浏览器默认行为。显影播放时保存普通阅读视图，临时隐藏计划 mesh 并锁定画布手势；返回逐针时恢复原计划开关、zoom 和 pan。计划偏好本身没有被改写。

### 进度与只读诊断

`StitchPlayer.normalizedProgress` 与 `getNormalizedProgress()` 返回有限的 0–1 值，沿用现有 `position`（一单位一针），不修改 SantaoTimeline 的秒级显影时间轴。`window.lihuaStitchDiagnostics()` 增加 `view`、计划 geometry/ghost 数量、计划显示/抑制状态和视图锁定状态，不记录个人信息。

### V4 验收

完整验收扩展在 `scripts/stitch-acceptance.cjs`。浏览器截图由真实运行页面生成：

- [22 完整 56 针计划](validation/22-plan-full.png)
- [23 第 28.5 针与剩余计划](validation/23-plan-progress-28.png)
- [24 约 200% 缩放](validation/24-zoom-200.png)
- [25 平移局部](validation/25-pan-detail.png)
- [26 Fit 恢复](validation/26-fit-restored.png)
- [27 针落点与计划](validation/27-plan-points.png)
- [28 移动端工具，390×844](validation/28-mobile-tools.png)
- [29 显影中计划隐藏](validation/29-cinematic-plan-hidden.png)

测试覆盖 0/28.5/42/56 针、计划开关不改进度、主 mesh partial drawRange、滚轮及鼠标拖动、单指/双指 Pointer 手势、Fit 不改播放、四种练习切换自动 Fit、视图 resize、显影五次进出并恢复，以及 20 次计划切换、20 次缩放/平移/Fit 和 12 次练习切换的资源计数。模拟触摸由浏览器 PointerEvent 验证，`physicalTouchDeviceVerified=false`。

本地 Edge/Playwright 验收不使用 Browser 插件（当前会话未提供）。课程专题与针法影像只做原功能回归，没有更改课程数据、标题、目录、iframe 或官方来源。47 项自动测试通过，静态站构建通过；Stitch Lab、显影及 AR/页面回归均通过。计划打开时资源稳定为 3 geometries / 1 texture，关闭计划时为 2 / 1；20 次显隐和 20 次视图操作不增长；显影 5 次进入退出恢复到逐针视图资源基线，离页归零。AR-Santao 使用合成相机流通过 MindAR 回归，非真实手机验收。AR 实现、MindAR、识别卡、targets.mind、散套 56 针 JSON 和 11 秒 SantaoTimeline 均未修改。

开源参考与许可边界见 [OPEN-SOURCE-INSPIRATION.md](OPEN-SOURCE-INSPIRATION.md)：Bastidor、Ink/Stitch 和 dst-format 只作交互/技术概念参考，Copied code 均为 None；没有新增第三方依赖。

## 官方影像与数字刺绣工具 V5

日期：2026-10-17。原有课程目录、课程 iframe 与练习联动不变；原 4 条视频入口、1 门课程、1 条官方资料保留。新增余福臻、邹英姿两条官方影像，合计 6 条影像、1 门课程、1 条非视频资料。两条新增内容归为“传承人”影像，不标记为针法教程。来源、分类边界和许可核验见 [VIDEO-SOURCES.md](VIDEO-SOURCES.md)。

Stitch Lab 后、基础练习前新增同一教学页内的小型“数字刺绣工具”卡片，没有一级导航。Ricuci 的数据位于 `content/digital-tools.json`，由 `assets/digital-tools-store.js` 独立负责校验、搜索和渲染。点击“打开工具”才创建 Ricuci 官方 iframe；关闭时销毁 iframe，且无跨 iframe 文件传输。机器针迹与苏绣传统手工针法的区别、文件本机处理说明均直接显示。源码、许可证、iframe headers 和实测结论见 [Ricuci 接入说明](../tools/RICUCI.md)。没有复制 Ricuci 代码、字体、GSAP 或品牌素材。

搜索新增 Ricuci、数字刺绣、机器刺绣、DST、PES、JEF、刺绣文件、转换；余福臻和邹英姿各自可在“官方影像与资料”搜索结果找到。

V5 本地浏览器验收由 `scripts/digital-tools-acceptance.cjs` 执行，输出截图在 `../digital-tools/validation/`；包括影像卡分类、Ricuci 实际 iframe 与文件输入控件、五次打开关闭、关闭后 DOM 移除、搜索，以及 390×844 响应式视口。Ricuci iframe 于 2026-10-17 在 Microsoft Edge 实测 HTTP 200，无 X-Frame-Options/CSP 响应头且页面确实渲染。第三方站点未来可调整安全策略，卡片同时提供外站入口。
