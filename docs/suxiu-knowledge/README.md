# 梨花季 · 苏绣数字知识库

更新日期：2026-10-15。入口：[苏绣知识手册](https://yzou6525-ai.github.io/lihuaji/#guide)。

这套静态知识库为手册和全站搜索提供可核验资料。现有故事文化库50条、纹样1038份和文创75件保持原样。首页、导航、样式文件、AR资源没有改动。

## 数据范围

本轮 **85条知识、33个官方来源**。针法 **22条**，国家级代表性传承人 **12人**，标准 **2条**。覆盖13类；本体项目及4个扩展项目分开记录。来源逐条见 [SOURCE-MANIFEST](SOURCE-MANIFEST.md)。

|类别|数量|
|---|---:|
|overview|2|
|history|5|
|craft-system|13|
|terminology|2|
|process|10|
|material|2|
|tool|4|
|work-form|2|
|institution|5|
|branch|4|
|inheritor|12|
|stitch|22|
|standard|2|

## 文件与职责

- `content/suxiu-knowledge.json`：唯一事实数据源，人工维护式JSON；没有会覆盖它的生成器。
- `content/suxiu-sources.json`：机构、原始链接、核验日期、使用边界。
- `assets/suxiu-knowledge-store.js`：浏览器加载、缓存、排名检索、按ID/类别查询。
- `scripts/validate-suxiu.mjs`：构建前校验；缺来源、假域名、坏关系、空字段等直接中断构建。
- `scripts/suxiu.test.cjs`：资料完整性、坏数据拒绝、检索、故障重试、原文件哈希保护。
- `scripts/suxiu-acceptance.cjs`：实际浏览器搜索与跳转验收。
- `app.js`：只接手册与全局搜索，复用原卡片、标题、搜索框；增加来源文字及可展开事实/关系。
- `scripts/build.mjs`、`package.json`、`.github/workflows/pages.yml`：增加知识校验及测试。

原 `build-cultural-knowledge.cjs` 仅负责原纹样语义库。本轮未修改它及其两个输出，重复运行旧脚本不会触碰新知识文件。

## 结构与真实性

知识记录含 `id/type/title/aliases/category/summary/facts/keywords/scope/relations/sourceIds/verified/expertReviewed/review`。每个fact有来源ID与证据级别。A级为本轮国家级官方机构，B级为苏州地方官方资料，是项目的来源分级，不是专家认定。

`verified=true` 仅表示已按官方正文核对所列简短事实；所有 `expertReviewed=false`。摘要由AI辅助改写，未经苏绣专家人工审定。来源权威不代表应用或教程得到机构背书。

`scope=suxiu` 表示来源明确讨论苏绣相关技艺，不表示苏绣独有。散套、打籽等按采用词条的描述保留传统刺绣通用范围；分型关系另行指向套针。流程以 `orderedSteps` 保存9个明确列出的工序，未推断作品针路。

标准只收编号、名称、目录状态、发布日期、实施日期与主管部门；`fullTextRead=false`。状态以2026-10-15访问时目录为准，应随官方更新复核。原教学不删除，仍标为项目自编练习/算法说明，排在官方检索结果之后。旧概述单独标明不属于本次核验条目。

## 使用与接口

手册原搜索框、网站顶部搜索均支持针法、人名、工序、标准号；标题精确匹配优先，其次别名、标题包含、关键词和事实文本。空搜索列出本库，未知词不返回编造回答。套针的关联资料可跳转平套、集套和散套；流程可点进各工序。

模块无服务器、数据库或npm运行时依赖；相对模块URL支持GitHub Pages `/lihuaji/` 子路径。接口均为异步：

```js
import {loadSuxiuKnowledge, searchSuxiuKnowledge, getSuxiuKnowledgeById,
  getSuxiuSourceById, getSuxiuKnowledgeByCategory} from './assets/suxiu-knowledge-store.js';
await loadSuxiuKnowledge();
const stitch = await getSuxiuKnowledgeById('stitch-santao');
const results = await searchSuxiuKnowledge('散套');
const source = await getSuxiuSourceById(stitch.sourceIds[0]);
const tools = await getSuxiuKnowledgeByCategory('tool');
```

内存缓存共享并发请求；失败后可重试。首次载入需要网络，载入后可离线检索，不等于新增离线安装或刷新离线支持。缺文件时显示提示并保留旧练习；失败不伪装为已核验资料。未来AR可以调用ID获取数据，但本次没有把知识接到任何动画或针法配置。

## 未录入的内容

不补九大类的未知名称；不补材料尺寸、丝线号、染色配方、专家意见、针路算法或未读标准条款。杨守玉创制年代与戗针方向存在来源差异，本轮不采用争议的确定值。孙燕云档案缺失的个人元数据留null。工艺体系仅有名称证据时只录归属，不编造步骤。详见来源清单的跳过项。

## 测试与证据

```sh
npm test
node scripts/build.mjs
node scripts/suxiu-acceptance.cjs
node scripts/story-acceptance.cjs
node scripts/ar-site-regression.cjs
node scripts/library-acceptance.cjs
```

浏览器测试使用原开发环境的Playwright/Edge；不随站点发布依赖。可设置 `SUXIU_TEST_URL=https://yzou6525-ai.github.io/lihuaji/` 对线上执行同一搜索验收。单位测试20项通过，构建成功；12组词分别在两处搜索通过，手机390px无新增横向溢出；已实测关系跳转、流程顺序、断网缓存、503后重试和异步切页。

`validation-report.json` 为结构校验与实际统计，`browser-report.json` 为搜索验收，`regression-report.json` 汇总现有功能回归，`preservation-baseline.json` 是变更前文件SHA-256。哈希测试保证原AR资源、布局样式、文化库和目录内容不变（文本统一换行后比较，二进制逐字节比较）；自动校验不构成文化事实专家审定。桌面模拟图片识别不替代手机真机AR测试。

## 本轮未做

没有新增AR、针法动画、后台、数据库服务器、AI远程搜索、框架或运行时依赖；没有更换首页/导航/颜色/字体/圆角/栅格。没有转载新的官方图片，也没有改故事译绣文化寓意。
