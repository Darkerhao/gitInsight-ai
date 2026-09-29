# 当前架构要点

## 日报可靠性（2026-09-29）

- renderer 的 ProjectReportDraft 独立持有 manualWorkContent；历史合并日报只向首项目恢复素材并提示核对归属。
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
