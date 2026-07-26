# Signal Atelier runtime QA boundary

## 结论

Electron renderer 的视觉验收可以拆成两层：静态浏览器验证 DOM/CSS/响应式，Electron 产物与测试验证 preload/IPC 边界。两层证据不能互相冒充。

## 本次做法

- Chrome headless 加载生产 renderer 产物，核对桌面与窄屏构图。
- `tests/ui-shell.smoke.mjs` 固化 Lucide、无 emoji、阶段 rail、pointer、reduced-motion 等表现层契约。
- `npm test`、typecheck、build 验证既有业务和 Electron main/preload 均可构建。
- 静态浏览器缺少 `window.api` 时出现的钱包提示被记录为 QA 环境限制，没有为消除截图提示而新增静默降级。

## 可复用判据

若静态预览依赖 Electron preload：优先明确验收边界；不要把缺少 preload 的报错误判为 renderer 回归，也不要为了截图干净而吞掉真实 IPC 错误。
