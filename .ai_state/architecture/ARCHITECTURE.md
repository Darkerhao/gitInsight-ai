# 当前架构要点

## 单一发行版（2026-10-13）

- 产品统一“码迹 AI”；移除 edition 构建注入、类型、元数据、界面标签和命令，scripts/dist.mjs 为唯一打包入口，产物为 release/<version>/MajiAI-*。
- package.name=gitinsight-ai、标准版 appId=com.shuzhi.gitinsight-ai 与 standard 更新渠道保持稳定，避免改变现有数据与安装身份。standard 仅为机器渠道标识，无产品选择分支。
- Windows/macOS/Linux 各一个打包任务。dev push 与面向 dev/main 的 PR 检查；main 检查后升版发布；手动构建仅 main。
- Lite 安装身份不同且 Windows 默认目录可重合，迁移采用备份→退出→卸载并保留数据→安装统一版；不跨 appId 自动安装、不新增运行时迁移或渠道别名。
- [设计](../sprints/single-edition/design.md) · [发布与升级](../../docs/release-workflow.md)

## 版本整合（2026-10-12）

- `feature/unified-version` 以简洁版 3.8.9 为基础恢复 main 的工作台、仓库、消息、帮助和任务日历；使用同一导航、useAssistant 和现有组件。日历读取多任务配置与执行日志，不恢复旧单任务实现。
- 日报状态表示生成结果；飞书提交结果来自 sync_logs，工作台分别统计，不混算。
- 合篇草稿通过 sourceRepos 保存全部真实来源，复用 projectReportActions 的生成、保存与发布。历史合篇恢复为一篇，保留原始输入和统计；不再拆成多份相同正文。历史续编替换未保存草稿前确认，取消不改变正文、素材与全局范围。
- 素材日报由 materialReport 主进程模块、共享分区定义和 useMaterialReports 编辑器承载；事实来源为手工素材，共用现有 AI 客户端、daily_reports、飞书防重和备份链路。
- 旧 role_materials 表按角色与日期保留，输出的素材身份存于 raw_input_json。角色/日期切换与异步操作有单一编辑上下文，更新已有日报时校验身份。
- `published` 由成功同步日志与日报更新时间派生，不新增状态列；旧简洁版备份允许没有素材表，启动时正常建表。

设计和验收见 [版本整合](../sprints/unified-version/design.md)。

## 关于与客户端更新（2026-10-09）

- 关于页通过单一 `appUpdate` 主进程模块访问 electron-updater；preload 仅提供固定的检查、下载、偏好、安装、链接和订阅操作，更新控制只接受主窗口调用。
- 主进程保存更新状态并通过事件推送；renderer 复用单一快照，避免较早的 IPC 响应覆盖较新的下载事件。旧 about→system 映射和无消费者的 about-* 全局样式已移除。
- 自动更新偏好独立保存在 `updater-settings.json`，复用原子写入。启动稍后及每 6 小时检查，下载后正常退出安装；主入口早期 quit 监听先应用最新偏好，覆盖普通退出与备份恢复直接退出，不打断编辑。
- GitHub 稳定 Release 使用单一 standard 渠道及各平台清单，随包生成更新源配置；CI 先上传完整草稿再公开 Release。下载和安装使用官方校验与平台 updater。
- 当前支持 Windows NSIS、Linux AppImage/deb/rpm；开发环境、免安装包和未签名 macOS 包明确显示限制。
- [运行证据](../sprints/about-updates/runtime-verify.md) · [发布说明](../../docs/release-workflow.md)。

## 桌面数据与工作流（2026-10-08）

- 主入口先获取单实例锁；pending 恢复和配置校验成功后才注册 IPC、创建窗口及启动同步。启动失败明确报告并停止。
- 配置与运行状态使用同一读改写队列；原子文件替换配合短期回滚记录避免配置/密钥混合。数据库持久化复用原子写入工具。
- renderer 的编辑任务保留用户未保存字段，后台快照仅更新 last*；主进程编辑保存保留队列内最新运行状态。
- 飞书提交统一进入主进程查重及同一日报在途锁；手动疑似重复/不可读需明确确认，定时任务停止并标记待核对。检查使用独立隐藏窗口和现有登录分区，不打断用户飞书窗口。
- 本地配置、仓库及历史先初始化；飞书元数据后台读取，不保存或覆盖编辑配置，IPC 参数显式可克隆。
- 设置页提供单一版本化 `.gitinsight-backup`，包含完整 SQLite 和非敏感配置。大小/结构/SQLite 完整性验证后才暂存恢复；重启应用前保留不可覆盖的本机原始快照，失败保留 pending 并停止启动。恢复清空凭据并关闭同步。
- 已移除无入口农场代码/类型及新建农场表，历史表不删除；打包仅使用 `electron-builder.config.cjs`。
- [本轮验证](../sprints/desktop-reliability/runtime-verify.md)。

## 自动版本与桌面发布（2026-09-29）

- `release.yml` 是唯一发布入口：main push → 复用 checks → patch 升版并原子回写 main/tag → 三平台固定 SHA 打包 → 汇总发布 Release。
- checks.yml 在 dev 推送、目标为 dev/main 的 PR 上独立触发；main 只通过发布流程调用检查，避免重复运行。其他分支推送不触发检查或打包。
- main 发布串行执行；升版前过滤过期源提交，竞争写入由 Git 非强制原子推送拒绝。GITHUB_TOKEN 回写不会再触发 push 工作流。
- 手动 workflow_dispatch 仅允许 main，只构建当前源提交，不升版或发布；其他分支或标签跳过全部任务。打包失败重跑 failed jobs 复用原版本。prepare 生成版本提交后，独立 sync-dev job 将准确 SHA cherry-pick -x 到最新 dev；普通 push 拒绝并发覆盖，空提交重跑跳过，冲突中止。同步失败单独重跑，不阻断三平台打包发布。
- Artifacts 保留版本子目录；Release 用递归 glob 收集安装包。旧 release-tag 脚本已删除。
- [操作说明](../../docs/release-workflow.md) · [验证证据](../sprints/main-auto-release/runtime-verify.md)。

## 日报可靠性（2026-09-29）

- renderer 的 ProjectReportDraft 独立持有 manualWorkContent；历史合篇通过 sourceRepos 保持单篇和完整素材。
- 单日生成和一周批量生成复用 runGenerationQueue，最多三项并发。单日页面通过 requestId 取消活跃 IPC 请求并停止排队任务；一周页面本轮仅复用并发上限，未添加取消入口。
- IPC 按调用窗口绑定 AbortController；生成在采集、AI、结构化提取与写入前检查取消。已进入持久化的完成结果允许返回并保留；取消不会回退生成模板。Git 采集本身不强杀进程，结束后检查取消。
- networkRequest 为非流式 JSON 集成提供包含响应体读取的超时：默认 60 秒，结构化提取 20 秒，模型诊断 10 秒。取消信号贯穿 AI 请求及诊断。
- syncFeishuDaily 返回 SyncFeishuDailyResult；远端成功后本地日志失败返回成功与警告，调用方保留已发布状态。发布 POST 不自动重试；超时提示核对远端记录。
- 数据库共享初始化 Promise；persistDatabase 将导出、写临时文件与替换正式文件串行执行，失败向调用方返回且队列可继续。

详细验收见 [设计与验收](../design/2026-09-29-report-reliability.md)。

## 日报工作流与交付（2026-09-29）

- `projectReportActions.ts` 是单个项目草稿生成、保存、发布的唯一实现。单日页面注入表单日期范围，批量页面注入草稿全天范围，历史页对已持久化记录调用同一发布动作。
- ProjectReportDraft 持有正文、人工素材、生成结果、保存 ID、飞书目标、工时和独立生成/发布状态；WeeklyReportDraft 仅额外持有日期。
- 页面保留配置保存、日期/重复确认、生成队列、工时分配与提示；共享动作不依赖 Vue 或 Element Plus，不刷新全页。
- `runProjectPublishBatch` 跳过已成功项；生成失败保留原正文及已发布状态；发布前保存脏草稿；本地日志警告保留远端成功状态。
- `reportState` 仅保留日期范围操作；旧合并生成/保存/发布入口、孤立预览和自动同步预览赋值已删除。自动同步仍保留任务状态、记录和通知。
- 日报入口使用任务名称；欢迎页显示真实配置状态，无定时粒子动画。工作区卡片保持静态，GSAP 已无消费者并移除。
- 奖励渲染在主动播放时加载独立 chunk，加载成功后才扣币。未对启动耗时作性能结论。
- 主窗口按鼠标所在显示器的 workArea 设置初始和最小尺寸，系统缩放由 Electron DIP 坐标处理。
- PR、主分支和发布复用 `.github/workflows/checks.yml`；发布打包依赖验证成功。真实 renderer 交互测试 mock IPC，测试产物仅写 `output/playwright/report-workflow/`，不清理已有截图。

本轮证据：[日报工作流验收](../sprints/report-workflow/verification.md)。
