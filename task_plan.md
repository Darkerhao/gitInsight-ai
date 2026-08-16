# 产品化优化修复任务计划

## 2026-08-16 项目周反思 v1

### 目标

新增独立项目周反思模块：按项目和最多 7 天日期范围读取有效日报，使用当前 AI 配置生成带日报证据的优点、问题、不足、改进动作和下周重点，并支持历史查看、复制与 Markdown 导出。

### 阶段

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 1. 分诊与设计 | complete | 通用日期区间模型、来源选择规则、严格 JSON 与证据约束已确认 |
| 2. 生成闭环 | complete | 纯函数、通用反思表、AI、IPC/preload 和生成页面完成 |
| 3. 历史与导出 | complete | 同范围覆盖、历史恢复、来源详情、复制和 Markdown 导出完成 |
| 4. 质量门禁 | complete | 专项测试、全量测试、typecheck、build、diff check 和 Electron 运行验证完成 |

### 约束

- 不改变现有单日日报、一周日报、自动同步与飞书 payload。
- 月反思、年度总结只复用通用表和日期范围，不在本轮实现。
- 不向 AI 发送本机绝对项目路径，AI 格式或证据校验失败时不保存伪结果。
- 保留无关 `.claude/worktrees/` 未跟踪元数据。

## 2026-08-16 一周日报批量工作台

### 目标

新增独立“一周日报”模块：选择多个项目和一周日期范围，一次性生成多天日报；每个项目/日期可单独编辑、保存、提交飞书，也可批量逐条提交；工时按同一天各项目日报的实际工作内容自动分配，并允许手动覆盖。

### 阶段

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 1. 分诊与设计 | complete | 明确复用现有生成/保存/飞书接口，不新增数据库和飞书协议；设计文档已落盘 |
| 2. 纯函数与页面实现 | complete | 日期切片、内容工时分配、周日报表格/编辑器/状态交互完成 |
| 3. 导航与契约同步 | complete | 路由、侧栏、共享类型、样式接入，单条/批量发布调用链闭环 |
| 4. 质量门禁 | in_progress | 周报 12/12、全量 35/35、typecheck、build、diff check 已通过；待最终 review/evaluator |

### 约束

- 不改变现有单日生成页和自动同步语义。
- 不新增后端表、不改变飞书 payload；批量发布按项目/日期逐条调用既有提交接口。
- 保留工作树中与本任务无关的 `.claude/worktrees/` 未跟踪元数据。

## 2026-08-04 多任务自动同步（方案 B）

### 目标

自动同步从全局单例升级为任务列表：每任务独立的仓库集合、飞书所属项目、执行时间、统计窗口与运行状态；旧配置无损迁移且升级日不重复提交。设计见 `.ai_state/design/2026-08-04-multi-auto-sync-tasks.md`。

### 阶段

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 1. 分诊与设计 | complete | 确认现状单例链路；A/B 两案用户选 B；设计与路由已落盘 |
| 2. 红区写者实现（worktree） | complete | autoSyncCore TDD red→green、类型/调度器/IPC 四件套/UI/迁移 |
| 3. 审阅与集成 | complete | 规格/回归/diff 审查完成，改动已 cherry-pick 回主树 |
| 4. 门禁 | complete | typecheck / build / npm test（含新套件）/ git diff --check 全绿 |
| 5. ship | complete | `_index.md`、`progress.md`、`CLAUDE.md` 已同步；CONTEXT.md 不存在且未新建 |

## 2026-07-25 Signal Atelier 工作台视觉与交互优化

### 目标

在不触碰 IPC、数据库与日报生成逻辑的前提下，把 renderer 壳层与日报生成主流程升级为沉浸式、可读、可操作的工作台；统一使用 Lucide 图标，清除可见 emoji。

### 阶段

| 阶段 | 状态 | 验收 |
| --- | --- | --- |
| 1. 规格与 route-note | complete | `.ai_state/_index.md`、route-note、design 已建立 |
| 2. TDD red / 结构契约 | complete | `node tests/ui-shell.smoke.mjs` 已按预期因缺少 `_atelier.scss` 失败 |
| 3. renderer 实现 | complete | 壳层、主流程、atelier 样式与 reduced-motion 完成 |
| 4. typecheck/build | complete | `npm run typecheck`、`npm run build`、现有测试均通过 |
| 5. runtime-verify / review / polish | complete | 审阅修复后复跑 smoke、14 个既有测试、typecheck、build、diff check、emoji scan；桌面/窄屏截图已核对 |

### 当前决策

- 黄区单模块 Feature，单一实现代理；主线程负责门禁与交付。
- 视觉方向：Signal Atelier（深墨画布、酸性绿/电光紫信号色、编辑部排版、指针光场）。
- 不新增依赖；复用现有 `lucide-vue-next` 与 Element Plus 能力。

### Review 结论与修复

- Standards：修正阶段状态源、中文可见文案/ARIA、删除无消费者 pointer token 与 scroll 状态。
- Spec：窄屏保留保存按钮；工作流 rail 增加 active/aria-current/IntersectionObserver；pointer 光场改为 rAF + 阻尼弹簧跟随。
- Polish：修正滚动进度条 `scaleX` 的非法百分比回退值；最终产物只保留第三方 PURE 注释警告。

### 最终证据

- `node tests/ui-shell.smoke.mjs`：pass。
- `npm test`：14/14 pass。
- `npm run typecheck`：pass。
- `npm run build`：pass。
- `git diff --check`：pass（仅 Git 行尾转换提示）。
- renderer emoji PCRE2 扫描：pass。
- Chrome headless：桌面 1600px 与移动 500px 静态构建产物截图已核对；移动端状态标签/用户文字已隐藏并保留头像与保存入口。静态浏览器不具备 Electron preload/IPC，不把该限制误记为业务链路验收。

### 已知错误

| 错误 | 次数 | 处理 |
| --- | --- | --- |
| PACE skill / orchestration 文件在用户级与仓库路径均缺失 | 1 | 按用户提供的铁律摘要执行，并记录到 route-note |
| 首次定位 router 路径错误（实际为 `src/renderer/src/router.ts`） | 1 | 改用定点路径读取 |
| Playwright wrapper/npx CLI 在当前沙箱无输出并疑似卡在包获取 | 3 | 保留 renderer-only 服务，后续改用可用的本地浏览器/静态验证；不绕过安全策略 |
| Playwright MCP 自动审批代理返回 404 | 1 | 停止该路径，使用既有 Chrome headless 证据与构建/测试门禁，不绕过审批 |
| 清理误创建空目录的 Remove-Item 被审批拒绝 | 1 | 不再重试破坏性删除；空目录不参与交付 |

## 目标

按照 `docs/productization-optimization-plan.md` 中列出的产品化问题，逐项完成可落地修复，并通过类型检查、构建或关键验证确认改动可用。

## 任务状态

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 建立基线 | complete | 读取现有代码、确认变更范围、建立跟踪文件 |
| 2. P0 飞书配置向导 | complete | 补齐字段映射配置入口与校验提示 |
| 3. P0 同步任务语义收敛 | complete | 将任务页改为全局同步计划语义，避免单任务误导 |
| 4. P1 配置保存状态 | complete | 增加 dirty 状态、统一保存反馈与执行前保存提示 |
| 5. P1 历史记录闭环 | complete | 支持历史日报加载、复制、导出、重新发布、跳转 |
| 6. P1 工作台前置检查 | complete | 快捷操作复用统一检查并引导补齐 |
| 7. P2 路由状态化 | complete | 引入 vue-router，支持刷新恢复和参数导航 |
| 8. P2 首次引导 | complete | 欢迎页改为首次/配置缺失时展示 |
| 9. P2 系统设置分区 | complete | 让设置 tabs 实际控制内容分区 |
| 10. 质量保障 | complete | 补齐脚本、运行验证并修复发现的问题 |
| 11. 2026-07-01 审计修复基线 | complete | 基于 `docs/project-issue-audit-2026-07-01.md` 梳理本轮修复范围 |
| 12. P0/P1 数据正确性 | complete | 修复敏感配置保存降级、简洁版日报保存与状态残留、手动同步去重 |
| 13. P2 体验闭环 | complete | 修复历史查询反馈、小屏导航占位、教程入口闭环 |
| 14. P2/P3 维护优化 | complete | 清理 GSAP 残留、补 favicon、修正文案、拆分 renderer vendor chunk |
| 15. 本轮质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、残留字符串检索均通过 |

## 执行原则

- 不删除用户已有变更。
- 优先改现有文件，除必要类型或测试外不新增无关文件。
- 每完成一个阶段更新本文件和 `progress.md`。
- 遇到错误记录到 `findings.md`，并更换修复方案。

## 2026-07-11 时间长河真实数据最终版

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 数据链路与测试基线 | complete | 已完成失败测试与 Node 内置测试基线 |
| 2. 数据库与领域接口 | complete | 已新增兼容迁移、每日成长快照表、查询与幂等写入接口 |
| 3. 日报生成联动 | complete | 日报保存或编辑后自动更新成长快照，历史日报查询时自动补建 |
| 4. IPC 与共享类型 | complete | 已暴露真实时间长河查询接口并补齐共享类型 |
| 5. 前端最终版 | complete | 已移除模拟数据、A/B 原型和切换器，接入真实数据及空状态 |
| 6. 旧农场收缩 | complete | 已移除前端路由、IPC 和 preload 农场入口，旧数据库表保持不动 |
| 7. 质量验证 | complete | 领域测试、类型检查、生产构建、diff 检查与模拟/农场入口残留扫描均通过 |

### 已确认测试边界

- `getTimelineSnapshot(range/filter)`：按时间范围和工作类型读取真实成长快照。
- `upsertTimelineSnapshot(reportId)`：从已保存日报生成快照，并保证重复处理幂等更新。

## 2026-07-04 奖励特效扩展任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 现状确认 | complete | 已确认奖励特效通过 `RewardEffectKey`、`RewardEffectOverlay.vue` 映射和 `CheckinRewardCenter.vue` 商店配置接入 |
| 2. 新增 15 个组件 | complete | 为用户列出的 15 种特效分别新增独立 Vue 组件 |
| 3. 接入入口 | complete | 扩展 effect key、持续时间、overlay component map、商店入口和背景氛围 |
| 4. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、rewards 尾随空白扫描均通过 |

## 2026-07-04 奖励特效视觉增强任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 视觉审片 | complete | 确认主要短板在全局电影感层、商店高级感和少数代表特效爆点 |
| 2. 全局增强 | complete | 增加开场白闪、中心冲击波、动态光晕、扫描线、暗角和按特效变色的舞台变量 |
| 3. 商店增强 | complete | 增加卡片扫光、图标能量环、特级卡片高亮和 popover 氛围背景 |
| 4. 单体强化 | complete | 强化 Crown、CyberDataFlow、SpaceJump、EnergyRing、RainGlass 的光圈、扫光、冲击波和环境效果 |
| 5. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check`、rewards 尾随空白扫描均通过 |

## 2026-07-04 飞书提交记录入口任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 发布流程定位 | complete | 已定位右侧“发布研发日报到飞书”按钮、飞书配置来源和现有飞书登录窗口复用逻辑 |
| 2. 主进程跳转能力 | complete | 新增 `feishu:open-submission-records` IPC，复用 `persist:feishu` 登录态打开飞书表单并自动点击“我的提交记录” |
| 3. 页面入口 | complete | 在发布按钮下方新增“查看日报提交记录”按钮，缺少飞书连接配置时引导到配置页 |
| 4. 质量验证 | complete | `npm run typecheck`、`npm run build`、`git diff --check` 均通过 |

## 2026-07-18 非 Git 工作内容补充任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 链路定位 | complete | 已定位生成页、IPC、AI Prompt、日报持久化与飞书发布链路 |
| 2. 输入与生成 | complete | 已增加可选的补充工作内容输入，并传入单项目/批量 AI 生成 |
| 3. 无提交降级 | complete | 已支持无 Git 提交时仅依据补充内容生成，本地模板同样保留补充事项 |
| 4. 历史与发布 | complete | 补充内容写入 `raw_input_json`，历史加载可恢复，飞书发布使用生成后的完整正文 |
| 5. 质量验证 | complete | 三轮验证完成：测试、类型检查、生产构建、diff 检查和模板结构检查均通过；本地浏览器预览被安全策略阻止，未绕过 |

## 2026-07-19 项目工时自动分配任务

| 阶段 | 状态 | 内容 |
| --- | --- | --- |
| 1. 现有链路定位 | complete | 已确认项目草稿、生成结果、默认工时和飞书发布工时链路 |
| 2. 分配算法 | complete | 按提交数与去重文件数计算权重，以 0.5 小时粒度分配当日总工时 |
| 3. 生成联动 | complete | 单项目和批量生成后自动回填，并保留手动工时 |
| 4. 发布侧反馈 | complete | 展示自动/手动来源、计算证据、总工时和重新计算入口 |
| 5. 质量验证 | complete | 算法边界与 60 组性质测试、现有测试、类型检查、生产构建和 diff 检查均通过 |
