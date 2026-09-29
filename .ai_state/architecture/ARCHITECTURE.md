# 当前架构要点

## 日报可靠性（2026-09-29）

- renderer 的 ProjectReportDraft 独立持有 manualWorkContent；历史合并日报只向首项目恢复素材并提示核对归属。
- 单日生成和一周批量生成复用 runGenerationQueue，最多三项并发。单日页面通过 requestId 取消活跃 IPC 请求并停止排队任务；一周页面本轮仅复用并发上限，未添加取消入口。
- IPC 按调用窗口绑定 AbortController；生成在采集、AI、结构化提取与写入前检查取消。已进入持久化的完成结果允许返回并保留；取消不会回退生成模板。Git 采集本身不强杀进程，结束后检查取消。
- networkRequest 为非流式 JSON 集成提供包含响应体读取的超时：默认 60 秒，结构化提取 20 秒，模型诊断 10 秒。取消信号贯穿 AI 请求及诊断。
- syncFeishuDaily 返回 SyncFeishuDailyResult；远端成功后本地日志失败返回成功与警告，调用方保留已发布状态。发布 POST 不自动重试；超时提示核对远端记录。
- 数据库共享初始化 Promise；persistDatabase 将导出、写临时文件与替换正式文件串行执行，失败向调用方返回且队列可继续。

详细验收见 [设计与验收](../design/2026-09-29-report-reliability.md)。
