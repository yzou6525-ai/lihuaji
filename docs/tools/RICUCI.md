# Ricuci 数字刺绣工具接入说明

核验日期：2026-10-17

## 项目和许可

- Project：Ricuci / embroidery-converter-kit
- Repository：[Federicokalik/embroidery-converter-kit](https://github.com/Federicokalik/embroidery-converter-kit)
- License：项目代码 MIT；其仓库明确说明字体为 OFL 1.1，GSAP 采用 GreenSock 自有许可。
- 官方 Web 工具：[https://ricuci.app/convert/](https://ricuci.app/convert/)
- 集成方式：用户点击“打开工具”后，站内创建官方 Web 工具 iframe；同时提供新标签页外链。
- Copied code：None。没有复制或重新打包 Ricuci 源码、UI、字体、GSAP、Logo、示例设计或媒体资源。没有建立代理或跨 iframe 文件传输。

## 工具边界与文件隐私

Ricuci 官方说明其转换在用户浏览器中运行，支持机器刺绣格式读取和转换。其文档明确这不是从 SVG/普通图像生成针迹的工具，也不是传统苏绣工艺教学。

梨花季将它作为机器刺绣文件查看/转换入口。机器刺绣文件中的针迹数据与苏绣传统手工针法并非同一体系。用户选择文件后由 Ricuci iframe 自行处理；梨花季不读取、不接收、不保存该文件，不进行跨 iframe 数据传输。iframe 不授予 camera、microphone 或 geolocation 权限。

## 实际 iframe 验收

2026-10-17 在 Microsoft Edge / Playwright 中，从梨花季公开 Pages 页面创建 iframe 并实际加载转换页面。请求 `https://ricuci.app/convert/` 返回 HTTP 200，frame load 事件触发，页面截图显示 Ricuci 转换界面。检查响应头：

| 检查项 | 实测 |
|---|---|
| HTTP status | 200 |
| X-Frame-Options | 未返回 |
| Content-Security-Policy | 未返回 |
| frame-ancestors | 无 CSP 响应头，未声明该限制 |
| Playwright 实际 frame load | 成功 |
| 复制源码 / 代理 | 否 |

页面初次访问可能展示 Ricuci 自己的一次性新功能提示；它属于官方 iframe 内部界面，梨花季不修改。

iframe 根据“打开工具”按钮延迟挂载，默认 0 个；同一时刻至多 1 个。点击“关闭工具”后移除 iframe DOM。移动端以 390×844 视口验证卡片、iframe 与按钮无横向溢出。由于第三方网站和网络状态由 Ricuci 维护，外链始终保留为替代入口。

完整浏览器验收脚本为 `scripts/digital-tools-acceptance.cjs`；截图位于 `docs/digital-tools/validation/`。目录数据为 `content/digital-tools.json`，由 `assets/digital-tools-store.js` 加载、验证、搜索和渲染。
