# 多任务自动同步（方案 B）设计

日期：2026-08-04 · 用户决策：放弃"单条日报多明细行"（方案 A），要求多个独立的自动同步任务。
用户飞书表单实测一天可提交多条记录（同步日志显示 08/02 单日 4 次成功），方案 B 的前提成立。

## WHY

现状 `AppConfig.autoSync` 是全局单例：一个时间、一个统计窗口、所有勾选仓库合并成一份日报、提交到唯一 `feishuForm.projectOptionId`。用户需要：仓库集合 A → 飞书项目 X、仓库集合 B → 飞书项目 Y，各自独立的执行时间/统计窗口/启停/状态。

## 数据模型（src/shared/types.ts）

```ts
interface AutoSyncTaskConfig {
  id: string; name: string; enabled: boolean;
  repoPaths: string[];
  projectOptionId: string; projectName: string;
  workHours: number | null;          // null → projectWorkHours[projectOptionId] → defaultWorkHours
  time: string;                      // HH:mm
  timeWindowMode: AutoSyncTimeWindowMode; windowStartTime: string;
  lastRunAt: string; lastSuccessAt: string; lastStatus: AutoSyncStatus; lastMessage: string;
  lastRunKey: string; lastScheduledRunKey: string; lastSuccessKey: string;
}
interface AutoSyncConfig { enabled: boolean; tasks: AutoSyncTaskConfig[] }   // enabled=总开关
interface AutoSyncTaskState extends AutoSyncTaskConfig { nextRunAt: string; isRunning: boolean }
interface AutoSyncState {
  enabled: boolean; tasks: AutoSyncTaskState[];
  isRunning: boolean; runningTaskId: string; nextRunAt: string; nextRunTaskId: string;
}
interface AutoSyncTaskRunResult { taskId; taskName; status; message; report?; date?; timeRange?; commitsCount? }
interface AutoSyncRunResult { status; message; ranAt; nextRunAt; taskResults: AutoSyncTaskRunResult[] }  // status=聚合(有 failed→failed，否则有 success→success，否则 skipped)
interface AutoSyncValidationResult { valid: boolean; message: string; results: Array<{taskId; taskName; valid; message}> }
```

## 迁移（关键：升级日不得重复提交）

`normalizeAutoSyncConfig(raw, ctx: {feishuForm, selectedRepoPaths})`：raw 无 `tasks` 数组但有 legacy 字段 → 生成 tasks[0]：name="默认任务"、repoPaths=selectedRepoPaths、projectOptionId/Name=feishuForm 当前值、workHours=null、time/window/全部 last* 字段原样继承。
**运行键格式保持不变**：`date::reporter::projectOptionId::mode@start::repos`（不掺 task.id）——迁移任务的 lastSuccessKey 与新键逐字符相等，当天幂等跳过继续生效。两个任务若 项目+仓库+窗口 完全相同会共享键（本身就是重复配置，可接受）。

## 调度器（electron/main/autoSync.ts + 新 autoSyncCore.ts）

- **autoSyncCore.ts**：纯函数、零 electron 依赖（TDD 边界）：normalize/迁移、buildAutoSyncTaskKey(task,ctx,date)、buildAutoSyncReportWindow(task,now)、getNextTaskRunDate(task,ctx,now)、getNextAutoSyncRun(config,now)→{taskId,runAt}|null（取最早）、selectDueAutoSyncTasks(config,now)（按 tasks 数组顺序）、resolveTaskWorkHours(task,feishuForm)。config.ts 的纯 normalize 助手迁入 core，config.ts 转为 re-export（不改既有 import 方）。
- 单一 setTimeout 定到最早任务；触发时顺序执行所有到期任务（全局锁 autoSyncRunning 保序），每个任务独立：validate → generateReport({repoPaths: task.repoPaths, window}) → syncFeishuDaily(formConfig 覆写 projectOptionId/projectName, workHours=resolveTaskWorkHours) → 按 task 更新 last* 并 emit `auto-sync:updated`；全部结束后重新武装定时器。
- 逾期未做（应用启动/唤醒补跑）语义按任务保留；总开关关 → 不调度；手动执行无视总开关（沿用现状）。

## IPC 四件套（ipc.ts / preload.ts / env.d.ts / types.ts 同步改）

- `auto-sync:get-state` → 新 AutoSyncState
- `auto-sync:validate` (config, taskId?) → 逐任务结果；不传 taskId 校验全部启用任务（至少 1 个启用任务，逐任务 repoPaths/projectOptionId 非空 + 共享的表单字段/汇报人/auth）
- `auto-sync:run-now` (config, taskId?) → 指定任务单跑（即使 task.enabled=false，用户显式意图）；缺省跑全部 task.enabled 任务；返回聚合 AutoSyncRunResult
- 推送 `auto-sync:updated` 载荷换新 AutoSyncState；renderer 接收侧容错 tasks??[]

## UI（AutoSyncCard.vue + assistant/autoSyncState.ts + configState.ts）

总开关行 + 任务卡片列表 + "新增同步任务"。每卡：名称、启用、执行时间、统计窗口、飞书所属项目（复用 projectOptions 拉取，降级手填 optionId）、仓库多选（扫描结果 + repoDisplayNames）、工时覆盖（可空，占位"留空=按项目默认工时"）、状态行（下次/上次/上次成功/状态/消息）、单任务"立即执行一次"、删除（确认）。新增任务默认：名称"任务N"、18:30、full-day、repoPaths=当前勾选仓库快照。保存前校验（configState 既有钩子）改为聚合逐任务结果，报第一个失败。中文文案、Element Plus、全局类名、Lucide、无 emoji。

## 测试（新 test:auto-sync 套件，仿 test:timeline 编译模式）

autoSyncCore 纯函数：legacy 迁移与键连续性、normalize 缺省/坏值、两种统计窗口边界、下次执行（未到点/已成功/逾期未做/任务停用/总开关关）、跨任务最早选取与到期排序、工时三级解析。既有 14 测试保持全绿。

## 明确不做

手动生成/发布链路不动（仍单项目）；方案 A 的多明细行不做；不做按任务的 AI Profile/汇报人（共享全局）；不做飞书一天一条的限制探测。

## 交付门禁

`npm run typecheck` · `npm run build` · `npm test`（含新套件）· `git diff --check`；CLAUDE.md 调度器/IPC 描述与 CONTEXT.md 相应段落更新。
