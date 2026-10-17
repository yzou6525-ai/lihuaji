# 自动化与线上回归记录

## 自动化单测与构建

| 检查 | 结果 | 备注 |
|---|---|---|
| Node `--test` 全部 10 个测试文件 | PASS：55 passed / 0 failed | 覆盖 AR state、故事、纹样库、知识库、针迹、课程、Ricuci、学习路径、11秒显影与 AR Santao 数据 |
| `node scripts/build.mjs` | PASS | 2 条学习路径各5步；85条来源关联苏绣知识；1,038条纹样；75个展示商品；静态站成功组装 |
| `npm test` 本地命令 | 本地未运行该命令 | 当前运行时不提供 npm 命令；执行了 package.json 中同一条 Node 测试脚本，55项全部通过。GitHub Pages workflow 对基线提交 `d98d036` 的 `npm test` 步骤通过 |

## 浏览器回归脚本

以下项目脚本均成功退出、报告 `ok: true`，且页面错误列表为空。它们运行于本地自动化浏览器和项目提供的合成/模拟输入，不是实体手机测试。

| 脚本 | 结果与关键覆盖 |
|---|---|
| `scripts/stitch-acceptance.cjs` | PASS：逐针、按钮、Plan/针落点、缩放/平移、56针与课程目录、切换、资源与离页RAF |
| `scripts/santao-cinematic-acceptance.cjs` | PASS：11秒时间线、暂停/继续、显影5次进出、恢复原视图、移动窄屏 |
| `scripts/ar-santao-acceptance.cjs` | PASS：梨花目标、AR显影、10次进出无资源增长；Canvas 合成流覆盖追踪、丢失、重获及手动暂停语义 |
| `scripts/digital-tools-acceptance.cjs` | PASS：Ricuci iframe 加载、5次开关、DOM移除、窄屏；没有读取或转换用户文件 |
| `scripts/learning-paths-acceptance.cjs` | PASS：套针/滚针五步、课程/知识/练习目标、本地进度阈值、损坏存储、搜索、390×844模拟视口 |
| `scripts/story-acceptance.cjs` | PASS：现有故事、译绣和 AR 流程回归 |
| `scripts/library-acceptance.cjs` | PASS：1,038条纹样、图像、地区检索、许可详情、配对游戏 |
| `scripts/suxiu-acceptance.cjs` | PASS：12个知识搜索、深链接、移动模拟视口、离线缓存和错误回退 |
| `scripts/ar-acceptance.cjs` | PASS：目标图层、相机授权边界、目标识别样本、窄屏；合成媒体流不等于真实相机 |
| `scripts/ar-site-regression.cjs` | PASS：首页及9个主要栏目载入、AR资源稳定性和模拟窄屏 |

没有独立的 `official-course-acceptance.cjs`。官方课程数据由 `stitch-course.test.cjs` 与 Stitch Lab acceptance 验证，正式 Pages 的线上检查也确认套针/滚针节点分别选择 `mooc-suxiu-02` / `mooc-suxiu-03`；课程视频播放未测试。

## 正式 Pages 线上回归

线上浏览器记录见 [`validation/public-browser-results.json`](validation/public-browser-results.json)，截图见 [`validation/INDEX.md`](validation/INDEX.md)。测试页面为 GitHub Pages 正式地址，不是 localhost。

- 首页等待正式 hero 内容渲染后检查；首页图片 9 张均完成加载并报告非零自然尺寸。
- `#ar/learn-tao`：显示5步，默认0/5；可进入官方套针课程节点并打开 `stitch-tao` 知识页面。
- `#ar/learn-gun`：滚针路径及数字练习 `demo-gun-basic` 可加载；其官方节点可选择 `mooc-suxiu-03`。
- `#ar`：AR iframe Ready，摄像头授权默认关闭；不授权时无需摄像头即可加载该页面。
- 390×844浏览器模拟无横向溢出。
- 第一方线上资源 HTTP 4xx/5xx：0；浏览器 console/page errors：0。

正式 Pages workflow 对基线代码提交完成并成功：<https://github.com/yzou6525-ai/lihuaji/actions/runs/38996562759>。本轮仅追加文档和证据；文档提交会再次触发 Pages 工作流，但不改变产品运行代码。

## 性能与资源

- Stitch Lab 播放/显影离页时的 requestAnimationFrame 由自动化断言取消；几何/纹理计数在循环后回到稳定值。
- AR Santao 显影重复10次的几何/纹理值保持一致；关闭时模拟相机流 tracks 为 ended。此项不证明实体相机硬件释放行为。
- Ricuci 在未点击“打开工具”时不创建 iframe；点击后可加载，关闭后 iframe 节点移除；未选择或上传任何文件。
- 本轮未做冷启动性能基准、实体设备耗电/温升测试或外部课程的视频缓冲测试。
