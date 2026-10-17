# 验收截图索引

截图来源只允许为 `publicPages`（GitHub Pages上的桌面浏览器自动化）、`localBrowser`（本地桌面浏览器自动化）或明确标出的合成画面。所有窄屏图都是 390×844 浏览器模拟，非手机实拍。截图不作为工艺真实性或实体相机证据。

| 文件 | 来源 | testedAt | deviceModel | browser / viewport | 说明 |
|---|---|---|---|---|---|
| `01-home.png` | publicPages | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge 153.0.4234.48 / 1280×900 / DPR 1 | 首页素材加载后截图 |
| `02-learning-tao.png` | publicPages | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge 153.0.4234.48 / 1280×900 / DPR 1 | 套针学习五步 |
| `03-official-course.png` | publicPages | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge 153.0.4234.48 / 1280×900 / DPR 1 | 点击课程后定位 `mooc-suxiu-02`；课程播放未测试 |
| `04-stitch-plan.png` | localBrowser | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge headless / 桌面视口 | Stitch Lab完整针迹计划 |
| `05-stitch-zoom.png` | localBrowser | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge headless / 桌面视口 | Stitch Lab缩放视图 |
| `06-santao-cinematic.png` | localBrowser | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge headless / 桌面视口 | 11秒数字显影完成态；不是实体针线运动 |
| `07-ar-real-camera.png` | 未生成 | — | 无实体手机 | — | 没有实体手机摄像头截图；严禁用合成相机图替代 |
| `08-ar-tracking-lost.png` | localBrowserSyntheticCamera | 2026-10-17 | 桌面浏览器 + 合成Canvas流 | Edge headless / 桌面视口 | 触发 MindAR lost 状态；不是实机失跟截图 |
| `09-ar-reacquired.png` | 未生成 | — | 无实体手机 | — | 实体手机重获目标截图未取得；自动化断言有通过但无实机证据 |
| `10-ricuci.png` | localBrowser | 2026-10-17 | 桌面浏览器自动化，无实体设备 | Edge headless / 桌面视口 | 第三方 iframe 加载态；未处理用户文件 |
| `11-mobile-learning.png` | publicPages | 2026-10-17 | 390px浏览器模拟，无实体设备 | Edge 153.0.4234.48 / 390×844 / DPR 1 | 非手机实拍 |
| `12-mobile-stitch.png` | publicPages | 2026-10-17 | 390px浏览器模拟，无实体设备 | Edge 153.0.4234.48 / 390×844 / DPR 1 | 非手机实拍 |

目录只保存已取得的代表图；未取得的真机证据保持缺失，不制作占位图片。

`public-browser-results.json` 保存本轮线上浏览器检查结果。设备字段和实测限制见 `../DEVICE-TESTS.md`。
