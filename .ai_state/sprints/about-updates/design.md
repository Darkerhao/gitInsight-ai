# 关于与应用内更新

## Round 1

用户需要一个类似参考图的“关于”入口，可以在应用内检查、下载并安装新版本，也能自动更新。

当前代码：`App.vue` 将 about 旧入口映射到 system；`electron/main.ts` 无 updater；electron-builder 26.15.3 发布 Lite/Standard 六矩阵安装包，但 workflow 未上传更新 YAML。当前 macOS 包明确禁用签名。

采用 electron-updater 6.8.9；已阅读该版本公开类型、AppUpdater、BaseUpdater、GitHubProvider、平台 updater 源码及本机 builder 的 updateInfoBuilder。

官方文档：https://www.electron.build/v26/docs/features/auto-update

## 实现方案

- 一个关于页面：沿用平台卡片、主题、Element Plus 控件和图标；显示品牌、发行版、真实运行版本、更新状态、进度、更新说明、项目主页与更新日志。
- 一个主进程更新模块统一管理状态、定时器和 electron-updater；preload 只暴露固定操作与状态订阅，安装和链接打开只接受主窗口请求。链接使用预定义键，不能传任意 URL。
- 自动更新默认开启：启动稍后检测，此后每 6 小时检测；发现稳定新版本后自动下载，正常退出安装。提供“重启安装”，由用户主动触发；关闭开关后停止定时检测与退出自动安装，已有下载可手动安装。
- BaseUpdater 的退出钩子仅在下载完成时注册：初始化保持 `autoInstallOnAppQuit=true`，主入口提前注册 `quit` 监听，退出时按最新偏好设置该属性，再由官方 quit 钩子安装。普通退出和备份恢复的 `app.exit(0)` 均遵循偏好，取消退出不会停止更新。macOS 当前禁用自动安装，不套用该平台的不同生命周期。
- 开关存入独立 `updater-settings.json`，复用 `writeFileAtomically`。它是应用更新偏好，与业务配置/密钥备份独立，避免修改现有严格备份格式或自动保存用户尚未保存的日报配置。
- 检查/下载只允许一个在途操作；下载或待安装时不发起新检查；失败可重试。主进程保存快照，页面重开和切换不丢状态；进度事件订阅可释放。
- 使用 builder 生成的 `app-update.yml`；GitHub publish 指定 owner/repo，channel 为 lite/standard；禁止预发布与降级。六矩阵分别上传 `{edition}.yml`、`{edition}-mac.yml`、`{edition}-linux.yml` 和 blockmap，Release 汇总时一并发布。
- Release 先作为草稿上传全部文件，全部成功后才公开并标记最新，避免客户端发现不完整版本。
- 支持 Windows NSIS 安装版、Linux AppImage/deb/rpm；开发环境和免安装包明确不支持自动安装。macOS 当前未签名发行版明确提示限制，不降低签名校验。平台差异由官方 updater 处理，不自建替换可执行文件方案。
- 更新说明以纯文本展示，外部内容不作为 HTML 注入。侧栏“关于”显示可更新标记，使后台发现/下载结果有入口。

## 验收标准

- AC1：关于页可从侧栏打开，显示实际版本与发行版；浅/深色及 900px、1366px 布局可用。
- AC2：可手动检查、查看无更新/有更新/错误状态、下载进度和下载后重启安装；IPC 失败可见且可重试。
- AC3：自动开关立即持久化并跨启动保留；启用时后台检测和下载，关闭后不自动检测/安装；不触碰未保存业务配置。
- AC4：主进程更新流程无重复下载或并发检查，未下载不能安装，离开页面不丢状态，无强制重启；不支持的安装方式明确说明。
- AC5：Lite/Standard 清单与下载包隔离，发布 glob 包含实际更新文件且不包含解包目录；稳定版不降级。
- AC6：真实 Electron 中验证 preload/IPC/页面和 updater 的本地 HTTP 检测、下载及哈希校验；隔离用户数据，不执行真实更新安装。

## Done Contract

- `npm run test:app-update`：更新状态/偏好/并发/错误恢复及下载校验相关回归全部通过。
- `node --test tests/releaseArtifacts.test.cjs`：产物清单隔离、上传范围与现有 main 自动升版契约通过。
- `npm run typecheck`、`npm run build`、`npm test` 通过。
- Playwright 关于页交互与布局通过；Electron 隔离 profile 实跑通过，外网发布及跨平台安装明确标记未验证。
- `git diff --check` 通过；完成独立代码和规格审查，更新架构与发布说明。

## Round 1 · Critic Findings

- 独立只读评审：未发现 P0/P1 关键遗漏，VERDICT PASS。
- 退出钩子策略已写入设计并纳入回归；跨平台真实安装仍需发布验证。
- 执行：隔离 worktree 为 `.cache/worktrees/about-updates`。本环境未产生可绑定的 raw SubagentStart 日志；不伪造生命周期，主线程作为唯一写者，独立 agent 只读评审。
