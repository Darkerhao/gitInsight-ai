# Runtime verification — 2026-10-08

## 测试场景
- `npm test` exit 0：全量原有及新增测试通过。最终补充发布测试后 `npm run test:reliability` 再次 exit 0，70/70；输出 `.cache/desktop-reliability-tests.log`。
- `npm run typecheck` exit 0。
- `npm run build` exit 0，只有 Element Plus 内部 PURE 注解既有警告。
- `node tests/desktopRuntime.smoke.cjs` exit 0（desktop_runtime worker 实际执行）：Electron 37.10.3 隐藏窗口、真实 Vue + preload + 43 个 IPC；第二实例 0 窗口/0 IPC/数据库无改动；配置、假密钥、日报跨重启持久化。
- 同一真实 Electron smoke：文件/确认对话框及 relaunch 在测试 bootstrap 中替换；实际导出备份、修改第二条日报及配置、实际恢复 IPC 写 pending、显式重启应用恢复；只恢复导出记录，凭证清空、同步关闭；恢复前快照与原文件逐字节相同，再次重启不变。所有数据使用临时 userData/sessionData，网络阻断，无真实用户文件访问。
- `npx playwright test --config .cache/playwright-local.config.mjs` exit 0（renderer_state worker 实际执行）：19/19，46.4 秒，系统 Google Chrome 155.0.8059.40；正式 Playwright 配置不改。覆盖原14项日报流程/缩放、挂起与失败的远端初始化、本地配置错误重试、运行通知不覆盖编辑、备份按钮取消/错误/重试/成功且保留未保存配置。
- `npm ci --ignore-scripts --dry-run` exit 0；所有保留依赖及应用版本不变。
- `git diff --check` exit 0。

## 边界
原生 Chromium 1243 下载曾 ECONNRESET，浏览器验证改用已安装 Chrome。下载后续完成 Chromium，但 headless shell 未完成，已停止本轮安装进程；不得把标准 Chromium 启动报告为已验证。飞书线上 DOM、真实发布、跨平台安装包未执行；查重脚本以隔离 DOM 和实际主进程调用链测试验证。恢复只对隔离测试数据执行，不覆盖用户资料。

## Reflect
初始化集成检查发现浅复制保留 Vue 工时对象 Proxy；已改为显式复制并以 structuredClone IPC 回归验证。原始磁盘错误不再静默回退。所有七项进入代码与规格审查。
