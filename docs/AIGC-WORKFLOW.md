# 梨花季 · 意 → 纹 → 绣 → 境

实施日期：2026-10-10。入口：https://yzou6525-ai.github.io/lihuaji/#story

## 实施前架构与风险

原项目是 GitHub Pages 静态 ES Module 网站：`app.js` 按 hash 切换页面，`assets/engine.js` 已有 12 种程序纹样、四套色谱以及图像分色和启发式针路；`assets/ar-experience.js` 使用 MindAR 与 Three.js、原有三张目标卡和六层梨花。内容来自 `content/`，学习记录保存在本浏览器。没有可运行服务端 AI。

此次保留首页、五项主导航、774 条图录、75 件文创资料、原站配色字体、FaceMesh、学习记录和原三张识别卡。新增故事页复用原站组件样式，新增样式限定在 `.story-workflow` 内；入口加在全部功能菜单及译绣页的小链接中。原纹样卡片不替换，详情末尾在有匹配资料时追加可折叠注解。

主要风险是把传统题材泛称为苏绣专用、把AI辅助来源核对说成专家审核、把程序化结果说成真实苏绣工艺，以及把未部署的接口说成AI成功。知识库与界面均明确区分这些情况。远程文本也不能直接决定文化解释：输出 ID 后再次核对本地 approved 白名单，解释与链接由本地资料重建。

## 阶段状态

| 阶段 | 状态 | 实际交付 |
| --- | --- | --- |
| P0 文化资料 | 已实现 | 50 条有来源的文化元素，14 条来源记录；12 种接入现有绘图器，38 种为参考条目 |
| P0 意 | 已实现 | 本地关键词、多情绪、关系、场景、选填祝愿；结构化结果，不宣称为大模型理解 |
| P0 纹 | 已实现 | 三套带 seed 的候选、来源、构图解释；换版、选择、增减纹样、色谱和构图调整 |
| P0 绣 | 已实现 | 接入原 `generate()`，保留尺寸、线距、颜色、针法选项，下载数字工艺参考 SVG 与针路 CSV |
| P1 接口与证据 | 已实现接口，远程推理未上线 | LocalRuleProvider、RemoteAIProvider、严格决策校验、故障回退、创作过程 JSON 与 SHA-256 |
| P2 境 | 已实现 | 生成 SVG 按语义拆成五张对齐 PNG；沿用原 LayeredPattern、三模式和互动；以固定梨花卡作为真实 MindAR 定位载体 |
| P3 选装服务 | 未启用，按本期可选范围保留 | EmbroideryExportProvider 明确拒绝未支持的 PES/DST；没有安装 ComfyUI、PyEmbroidery、Ink/Stitch 或 ImageTracerJS |

没有给本项目接上付费服务或新增服务器；未建立后台模型代理。新版不改变 README 里既有的交易与账户功能边界。

## 文化资料的审核含义

`reviewStatus: approved` 表示本项目完成公开来源与所列短摘要的核对，具体方法记录为 **AI辅助公开来源事实核对**。`expertReviewed: false`，没有专家签名、手工审核或机构背书。A/B/C 是本项目的来源分级，不是官方认证等级；本批条目采用博物馆/官方来源。未来人工复核应独立记录姓名、日期、范围和修订，不覆盖原核对记录。

事实位于 `verifiedFacts`，确有语义证据的寓意才放 `verifiedMeanings`。梨花、莲池等只有形态证据的条目不凭空附加“相守”“清廉”。双蝶的喜相逢只在组合语境下解释。未知年代和地区留空，不猜测；全部纹样未被标为苏绣专用。`craft.verified` 为 false，针法、丝线色号和制作顺序没有自动填入。

情绪索引、兼容表、构图类型和色谱是项目自己的当代设计规则，已经用 `designRulesOrigin` 区分；它们不是馆藏原物的配色或传统规范。空的兼容/不兼容表表示未定义约束，不证明所有组合都有历史依据。现有 `engine.js` 的旧 `meaning` 仅为兼容保留，新流程不读取它作为文化事实。

主要依据包括：

- [故宫《陈师曾梨花图轴》](https://www.dpm.org.cn/collection/paint/231017.html)：支持梨花作为花鸟题材，不支持将相守写成通用传统含义。
- [故宫《五清》](https://www.dpm.org.cn/lemmas/241515.html)：支持四君子与五清题材的组合和品格语境。
- [故宫《香色纱绣八团夔龙单袍》](https://www.dpm.org.cn/collection/embroider/230670.html)：吉祥图案与杂宝词条，保留具体组合语境。
- [中国非遗网·苏绣](https://www.ihchina.cn/project_details/13978/)：苏绣项目与技艺背景。国家标准、地方标准目录也列入 sources；本次未据目录页声称已掌握标准全文或生成合规生产参数。

每条知识和来源都可在故事页末尾展开查看。只保存简短改写和链接，不下载新的馆藏图像，不宣称原图可商用。

## 模型无关接口

`RemoteAIProvider` 接受部署者配置的 HTTPS endpoint；预期代理路由为 `POST /api/story-to-intent`，但 GitHub Pages **未部署此路由**、不会默认发送该请求。本版 UI 没有启用远程开关，默认始终使用本地规则。要启用未来代理，需要另行配置服务并获得发送故事的明确同意。客户端不接收或保存API密钥。

请求结构：`{story, approvedKnowledge, promptVersion}`。代理也必须使用自己维护的 approved 知识版本重新校验，不能信任浏览器提交的审核状态。响应契约在 `contracts/story-to-intent.schema.json`。模型只返回允许的情绪/场景/构图、色谱索引和纹样 ID；`evidence` 为空，前端从资料库生成真实来源。

客户端校验未知字段、类型、枚举、列表边界、重复 ID、approved 状态和来源存在性。文化解释不使用模型自由文本。任何网络错误、超时、格式错误或越界 ID 都回退 LocalRuleProvider，并返回 `fallbackReason`。测试使用假 HTTP 响应验证协议，**不是一次真实模型推理**。

服务端未来需在环境变量中存储模型密钥，做大小限制、身份/频率限制、来源限制、模型 JSON Schema 校验与日志脱敏，才能上线；本期没有伪造这些已部署。

## 输出与人机协同记录

“下载完整创作过程”生成 `lihuaji-aigc-session.json`，包括：

- 原始故事、用户补充选项、时间、promptVersion；
- 实际 provider、model、version、isAIInference、usedRemoteAI；本地规则 model 为 none；
- 检索知识 ID、来源 URL、结构化意图；
- 三套初始候选、换版后的候选历史、seed、完整 SVG；
- 用户实际点击的选择、增删纹样/配色/构图的前后值、操作时间；
- 最终候选、数字工艺参数、输出 SVG/CSV、参考评分；
- 纹样与最终 SVG 的 SHA-256、是否发生人工修改。

保存的是实际发生的操作。未点击选择时 selected 为 null；未改动时 humanModified 为 false；未运行远程模型时 usedRemoteAI 为 false。开发中AI助手写代码/整理资料，与用户创作时是否调用AI模型是两件事，都应如实披露。SHA-256只校验内容一致，不是版权确权或上链。

故事和作品保存在当前标签页的 JS 内存，不自动存入 localStorage、GitHub、公共日志或服务器。刷新/关闭会丢失本次创作；用户可导出后自行保管。导出文件包含原故事，不应未经处理上传公开仓库。浏览器测试只用固定的虚构示例。

## AR 的实际方式

`createARLayersFromSVG` 只接受本项目支持的安全 SVG 标签与属性；拒绝脚本、外部资源、事件属性和外部 URL。使用 background、branch、secondary、primary、detail 五个显式语义组，各渲染为 1024×1024 RGBA PNG，保留原画布坐标，临时 Blob URL 用后释放。

这是从程序化矢量结构拆层，不是AI识别图像内容或生成三维网格。用户新增作品进入现有赏纹/解绣/看针、展开收拢、拖动和点选流程。**扫描下方原梨花识别卡，显示自己的作品**；没有声称能扫描任意刚生成的图案。此方案避免在低端手机里重新编译每份 `.mind`。未来若要直接扫描新作品，需独立编译识别目标并实测。未核验工艺字段继续显示“资料待补充”。

## 测试与复现

基础测试无需安装运行时依赖（Node 20+）：

```sh
npm test
npm run build
```

浏览器测试使用 Playwright 和本机 Edge；仅开发测试需要，访客不需要安装：

```sh
node scripts/story-acceptance.cjs
node scripts/ar-acceptance.cjs
node scripts/ar-site-regression.cjs
```

结果见 `docs/story-validation/`。规则测试覆盖未审核/缺来源拒绝、空输入、多情绪、未知故事中性回退、seed重现、远程失败/非法响应回退、机器格式明确拒绝和客户端凭据扫描。浏览器测试覆盖 SVG 解析、真实下载、输出哈希、五层展示、固定卡真实匹配、断网后规则与译绣、详情注解及手机尺寸。凭据模式扫描不能代替完整安全审计。

## GitHub Pages 验收

1. 打开 `#story`，点“填入毕业重逢示例”再生成，看到三套候选；展开来源。
2. 选择一套，改色谱或增删纹样，点击“应用人工调整”。
3. 送入译绣，设置尺寸/颜色/线距，勾选图片使用说明，生成并下载 SVG / CSV。
4. 进入“我的绣境”，切换赏纹/解绣/看针；示例识别会对梨花定位卡执行真实匹配。
5. 回到故事页或工艺结果页，下载过程 JSON，检查操作和输出哈希。
6. 回访首页、纹样库、游戏、旧 AR 与文创试搭，确认原页面可用。

提交 main 后自动构建、运行 Node 测试、发布。支持 `/lihuaji/` 子目录。部署版本无本机端口依赖，电脑关机不影响 GitHub 托管。

## 已知限制与依赖

本期没有真实LLM推理、专家工艺审核、机器刺绣试样、ComfyUI精修；不能称为完整商业后台或真实苏绣生产方案。50条资料不等于50种可生成形状，当前12种可绘制。规则只能匹配有限词汇，可能误解否定或隐喻，必须由用户最终选择。短句可输入，上限500字，100—500字为建议长度。

“离线”指页面与资料已载入后的本地计算；没有新增离线安装包/Service Worker，不保证断网后首次打开或刷新可加载站点。Android/iPhone真实相机和WebXR仍未真机验证，桌面合成媒体测试不替代真机。

新增部分没有第三方运行时依赖。原 Three.js、MindAR 保留原 MIT 许可，Noto 字体保留 OFL。考察了 [Transformers.js](https://github.com/huggingface/transformers.js) 与 [ImageTracerJS](https://github.com/jankovicsandras/imagetracerjs)，本期没有复制其源码或安装模型。PyEmbroidery、Ink/Stitch、ComfyUI 与 Stable Fast 3D 未引入，其许可和部署要求不应被描述成本项目已满足。

## 修改文件

内容：`content/cultural-knowledge.json`、`content/sources.json`。

模块：`assets/knowledge-retriever.js`、`assets/intent-engine.js`、`assets/story-page.js`、`assets/story-session.js`、`assets/embroidery-export.js`、`assets/ar/svg-layers.js`、`assets/story.css`。

接入：`app.js`、`assets/engine.js`、`assets/ar-experience.js`、`assets/ui.js`、`index.html`。

构建与验证：`scripts/build-cultural-knowledge.cjs`、`scripts/story.test.cjs`、`scripts/story-acceptance.cjs`、`scripts/build.mjs`、`package.json`、`.github/workflows/pages.yml`。

文档与契约：本说明、`README.md`、`contracts/story-to-intent.schema.json`、`docs/story-validation/`。
