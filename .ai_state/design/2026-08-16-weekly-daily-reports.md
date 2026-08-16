# 一周日报批量工作台设计

日期：2026-08-16

## 目标

提供一个独立页面，按“日期 × 项目”维护一周日报草稿。用户选择日期范围（最多 7 天）和多个仓库后，页面并发调用现有日报生成接口；每个单元格可编辑、保存、单独提交飞书，或按当前范围逐条批量提交。

## 复用边界

- 生成：复用 `window.api.generateReport({ date, repoPaths: [repoPath], ... })`。
- 保存：复用 `window.api.saveDailyReport`，以生成返回的 `historyId` 覆盖保存。
- 飞书：复用 `window.api.syncFeishuDaily`；批量提交保持逐条调用，任何一条失败都记录到对应单元格，不回滚已成功记录。
- 数据：草稿状态只在页面内维护；生成/保存后由既有本地数据库持久化，关闭页面后可从历史日志恢复，不新增 schema。

## 草稿模型

```ts
WeeklyReportDraft {
  key: `${date}::${repo.path}`
  date: string
  repo: RepoInfo
  report: string
  reportId: number | null
  result: ReportResult | null
  projectOptionId: string
  workHours: number
  workHoursSource: 'default' | 'estimated' | 'manual' | 'unresolved'
  generateStatus: 'idle' | 'generating' | 'success' | 'failed'
  publishStatus: 'idle' | 'publishing' | 'success' | 'failed'
  dirty: boolean
  message: string
}
```

## 日期与工时

- 默认日期范围为最近 7 个自然日；日期范围选择器限制最多 7 天。
- 自动生成按日期 × 项目并发执行，使用单项目生成避免把多个项目合并成无法分别编辑的正文。
- 同一天内按每份日报“今日工作内容”段落的工作条目数与有效字符数计算内容权重；先从 `defaultWorkHours` 扣除手动工时，再将剩余容量按 0.5 小时粒度分配到有内容的未手动项目，尾差按权重从高到低分配。
- 没有任何内容时不做估算；手动修改后标记为 `manual`，强制重新估算才覆盖手动值。
- 当剩余容量不足以给每个待估算项目分配 0.5 小时时，将相关草稿标记为 `unresolved`，阻止提交飞书，直到用户手动确认或重新估算。

## 发布语义

- 单独发布：只提交当前选中的日期/项目草稿，发布前自动保存脏草稿。
- 批量发布：按日期升序、项目顺序逐条提交；显示成功/失败计数，失败项可以单独重试。
- 飞书项目选择沿用全局项目选项，并允许每个项目草稿单独覆盖目标。

## 非目标

- 不改变单日“日报生成”页面。
- 不增加周报合并正文、后端任务表、飞书批量接口或自动同步任务配置。
