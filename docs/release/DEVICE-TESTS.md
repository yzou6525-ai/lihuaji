# 设备验收记录

正式线上入口：<https://yzou6525-ai.github.io/lihuaji/>

本地自动化对照入口：项目自带临时静态测试服务。
验收日期：2026-10-17

## 实体设备记录

当前任务环境没有连接可操作的 Android 或 iPhone；没有用户手机屏幕录像或设备截图作为证据。因此不登记虚构的设备型号、操作系统、浏览器版本、屏幕尺寸或测试人员，也不把浏览器模拟视口记作真机。

| 字段 | 结果 |
|---|---|
| deviceModel | 未提供 / 本轮未连接实体手机 |
| OS / OSVersion | 未测试 |
| browser / browserVersion | 未在实体手机测试 |
| screenSize / devicePixelRatio | 未在实体手机测量 |
| testedAt / tester | 实体测试未执行；无设备记录 |
| result | PARTIAL（仅已完成浏览器自动化部分） |
| physicalDeviceVerified | false |
| realCameraVerified | false |
| realTouchVerified | false |
| trackingLostPauseVerified（实体设备） | false |
| trackingResumeVerified（实体设备） | false |
| manualPauseVerified（实体设备） | false |
| RicuciPhysicalDeviceVerified | false |
| MOOCPhysicalDeviceVerified | false |

## 浏览器自动化（不属于真机）

| 项目 | 记录 |
|---|---|
| 浏览器 | Microsoft Edge 153.0.4234.48，Playwright headless |
| 页面 | GitHub Pages 正式站、`#ar/learn-tao`、`#ar/learn-gun`；AR 的独立测试页面 |
| 浏览器视口 | 桌面 1280×900/1200×1050；窄屏 390×844 |
| DPR | 窄屏自动化默认值 1；不代表手机实体面板 |
| console/page errors | 线上路径检查为 0；既有本地 acceptance 脚本均报告 `errors: []` |
| 第一方失败资源 | 本轮线上检查为 0 个 HTTP 4xx/5xx |
| 触控 / 相机性质 | 鼠标与合成 Pointer、合成 Canvas 媒体流；非真实触摸或实体摄像头 |
| 结果 | PASS（浏览器自动化范围） |

站内 XR 摄像头入口默认未勾选授权；线上验收确认打开 AR 页本身没有请求实体相机。

已完成线上路径：套针默认五步和 0/5、选择 `mooc-suxiu-02`、打开 `stitch-tao`；滚针路径、选择 `mooc-suxiu-03` 和 `demo-gun-basic`；390px 页面无横向溢出。页面离开、显影退出和 iframe 关闭等资源行为由现有自动化脚本覆盖。

## 等待实体设备验证

Android Chrome 与 iPhone Safari 均未验证。真实后置摄像头授权、实际卡片识别和手持追踪、手指 pan/pinch、Ricuci 与课程在手机端的真实可操作性，均保持未验证。合成流测试只验证算法与状态机，不证明实际相机表现。
