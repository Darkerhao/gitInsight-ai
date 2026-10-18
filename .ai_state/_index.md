---
path: Refactor
stage: plan
current_sprint_slug: report-performance
current_roadmap_slug: report-performance
route_confidence: 0.98
next_action: "剩余性能项：Git 采集、日报流式预览和数据库合并持久化"
pointers:
  latest_architecture_update: architecture/ARCHITECTURE.md
---

# AI State Index

## 本轮状态（2026-10-17）

- 第一轮启动优化完成：恢复已有仓库与本地数据后后台扫描；业务页懒加载与生产压缩；立即移除离场页面、80ms 淡入；Performance API 分段计时与可复跑命令。
- 修复审查发现的后台扫描覆盖生成进度、Vue 离场仍等待两帧导致新页位置跳动；对应回归先失败后通过。
- 当前工作区默认日报首屏静态 JS 5,986,293 → 1,263,712 bytes，减少 78.89%；不含 ECharts/3D，无新增依赖。
- 验证：可靠性 91/91；审查前全量浏览器 58/58、修正后相关页面 26/26；最终类型/构建、隔离 Electron 与当前工作区集成构建/冒烟通过。未验证真实安装包可见冷启动、大历史数据或窗口唤起目标。
- 独立代码、规格、evaluator 与收敛检查 PASS；证据和审查见 `sprints/startup-performance/`，架构已更新。复用既有隔离 worktree 并同步至 dev，保留原项目状态内容，未提交或推送。

## 本轮状态（2026-10-14）

- 仓库中心支持添加后逐仓库关联、编辑名称/项目和清除关联；日报与批量补日报自动选择仓库目标，手选保留，合篇不混用不同项目。
- 仓库设置先持久化后应用；失败不改变草稿发布状态。旧配置/备份可加载，表单切换清除旧草稿目标。
- 验证：当前工作区 npm test 192/192、类型检查和构建通过；Chrome E2E 41/41，深浅主题截图已查看；独立只读审查与收敛检查 PASS。
- 设计/验证/审查：sprints/repository-feishu/；功能代码已同步当前工作区，保留期间提交的工作台变更。未真实发布飞书或提交本轮功能代码。

## 本轮状态（2026-10-13）

- 单一发行版完成：三个平台统一为码迹 AI；dev 检查、main 发布；main 版本提交由独立 sync-dev job 自动 cherry-pick 至 dev。
- design: `.ai_state/sprints/single-edition/design.md`
- evidence: `.ai_state/sprints/single-edition/runtime-verify.md`
- review: `.ai_state/sprints/single-edition/reviews/pass2.md`；代码/规格/最终评估 PASS，polish PASS。
- 验证：完整 npm test、check、发布增量 13/13、关于页 9/9、Electron 桌面和更新 5 场景通过；Windows NSIS 构建、元数据与 SHA-512 校验通过。
- 隔离 worktree 改动同步回 dev，保留前序 CI 修改。未提交、推送或真实安装/发布。

## 本轮状态（2026-10-12）

- main 与 feature/simple-version 功能在新分支 `feature/unified-version` 整合，原分支保持不变。
- design: `.ai_state/sprints/unified-version/design.md`
- evidence: `.ai_state/sprints/unified-version/runtime-verify.md`
- review: `.ai_state/sprints/unified-version/reviews/pass2.md`，代码、规格及 evaluator 均 PASS，历史草稿覆盖 P2 已关闭。
- 验证：178 项完整单测、44 项全量 E2E、16 项增量 E2E，修复后合篇 5/5、历史 6/6、类型检查和构建通过；隔离 Electron 冒烟通过。
- 本地双父 merge commit 已完成，代码、规格、evaluator 与 polish 均 PASS；原分支不变，未推送或发布。

## 本轮状态（2026-10-09）

- 关于与应用内更新：Refactor，单一客户端更新闭环，覆盖主进程、IPC、界面与发布清单。
- design: `.ai_state/sprints/about-updates/design.md`
- evidence: `.ai_state/sprints/about-updates/runtime-verify.md`
- review: `.ai_state/sprints/about-updates/reviews/pass2.md`（代码、规格与 evaluator 均 PASS，退出路径 P2 已关闭）
- 验收：165 项单测、28 项浏览器回归、5 项 updater 实跑、桌面回归、类型检查、构建及 Windows NSIS 打包通过。
- 当前工作区初始干净，所有改动已集成；未提交、推送或发布。
- 临时 worktree 已完成职责，但删除被自动审批策略拒绝，保留 `.cache/worktrees/about-updates`。

本轮入口：新增关于页与应用内自动更新。

## 本轮状态（2026-10-08）

- path: Refactor
- stage: ship（本地实现与验收完成，未提交/推送）
- current_sprint_slug: desktop-reliability
- current_roadmap_slug: desktop-reliability
- design: `.ai_state/sprints/desktop-reliability/design.md`
- route_confidence: 0.98
- next_action: 本轮本地交付完成；无待实施项
- evidence: `.ai_state/sprints/desktop-reliability/runtime-verify.md`
- review: 代码审查、规格审查、最终评估及 polish 均 PASS
- 验收：全量测试、70项可靠性回归、类型检查、构建、19项系统 Chrome E2E、隔离 Electron 启动及备份恢复通过。
- 工作区：复用当前干净 checkout，互斥写集；不提交或推送。

## 本轮状态（2026-09-29）

- path: Refactor
- stage: ship（本地实现与验证完成，尚未推送）
- current_sprint_slug: main-auto-release
- design: `.ai_state/sprints/main-auto-release/design.md`
- evidence: `.ai_state/sprints/main-auto-release/runtime-verify.md`
- review: 独立代码/规格审查及最终评估 PASS
- route_confidence: 0.96
- 验收：发布专项 7/7、actionlint、类型检查、构建、diff check 通过。
- next_action: 改动合入 main 后由首次实际运行验证远端写权限与跨平台安装包。
- 工作区：复用当前 feature/simple-version；保留用户原有三处前端修改。

## 上轮日报工作流状态（2026-09-29）

- path: Refactor
- stage: ship（实现、运行验证、独立审查、评估与收敛检查完成）
- current_sprint_slug: report-workflow
- design: `.ai_state/design/2026-09-29-report-workflow.md`
- evidence: `.ai_state/sprints/report-workflow/verification.md`
- architecture: `.ai_state/architecture/ARCHITECTURE.md`
- route_confidence: 0.97
- 验收：104 项业务测试、2 个既有 smoke、类型检查、构建通过；14 项浏览器回归通过。
- next_action: 本轮已完成；真实硬件系统缩放与启动耗时未实测。
- review: 独立 final_review 无未解决 P1/P2，规格 PASS；final_evaluation Evidence Cross-Check / VERDICT PASS。
- 工作区：复用当前 checkout，初始干净；实现主线程执行，调用链调查由只读 explorer 完成，第二个调查 agent 遇到服务限流。

## 上轮路由（归档）

- stage: ship
- route: 黄区 / Feature，跨数据库、AI、Electron IPC 和 renderer 的完整闭环
- design: `.ai_state/design/2026-08-22-weekly-summary.md`
- writer: 主线程直接执行
- confidence: 0.96
- current_roadmap_slug: none
- current_sprint_slug: weekly-summary

## route_history

- 2026-10-18: Bugfix / feishu-record-hours；真实飞书记录页的工时字段带（h）单位导致查重解析失败，定点修正与失败诊断；置信度 0.99。保留 report-performance 主任务状态，不提交或发布。

- 2026-10-17: Refactor / report-performance；用户授权继续三项剩余性能优化，调用链和验收明确，涉及主进程/IPC/渲染/持久化；置信度 0.98。隔离 worktree 实施，保留第一轮，不提交或推送。

- 2026-10-15: Refactor / startup-performance；用户已确认首轮范围，涉及启动状态、页面加载、构建和计时；置信度 0.98。隔离 worktree 实施，本地验收后同步回当前 checkout，不提交或推送。

- 2026-10-14: Refactor / repository-feishu；配置、仓库和日报目标统一关联，单一业务闭环；置信度 0.97。隔离 worktree 实施，保留在途 UI 改动。

- 2026-10-13: Refactor / single-edition；单一安装身份、发布渠道与界面合同跨模块收敛；置信度 0.96。隔离 worktree 实施，保留已有 CI 调整。

- 2026-10-12: Refactor / unified-version；以简洁版新数据链路恢复 main 独有页面与素材日报，仅新分支整合；置信度 0.96。

- 2026-10-09 关于与应用内更新：Refactor，现有客户端无 updater，需统一接入两个发行版的检测、下载、安装和发布清单；置信度 0.97。

- 2026-10-08 桌面可靠性：Refactor + roadmap，七项明确改进涉及数据、任务、发布和 renderer；既有复现支撑，置信度 0.98。

- 2026-09-29 main 自动发布：Refactor，单一 CI 发布闭环，涉及工作流、旧脚本清理、契约测试与说明文档；置信度 0.96。复用当前 checkout，保留三处前端在途修改。

- 2026-09-29 日报流程收敛：Refactor，三个独立切片为草稿操作、CI/交互回归、导航/动效/小屏；置信度 0.97。

- 2026-09-29 日报可靠性：Refactor，用户确认优先修复内容可信度、项目素材归属、发布结果、请求控制与原子保存；复用干净工作区，互斥写集并行实施，未新增依赖。实现与全量验证通过，独立审查服务不可用。

- 2026-07-25 Signal Atelier UI：黄区 renderer Feature，已 ship（14 测试+smoke+typecheck+build 全绿）
- 2026-08-04 多任务自动同步：分诊确认现状为全局单例配置（autoSync.ts 单跑单提交）→ 提供 A（单条多明细行）/B（多任务调度）两案 → 用户选 B → 红区 worktree 写者；升级日幂等靠运行键格式不变
- 2026-08-10 多任务自动同步：写者完成多任务核心/调度/IPC/UI/迁移并集成；核心测试、typecheck、build、npm test、diff check 全绿；UI smoke 与未改造基线同因既有奖励组件 emoji 断言失败
- 2026-08-16 日报配置 Git 边界：将基础配置拆为 Git 提交采集与日报/同步两组，并在自动同步的统计窗口/统计仓库处补充 Git 标记；未改动配置模型或业务调用链
- 2026-08-16 Git 作者邮箱匹配：Git 日志采集 author email，筛选支持名称或邮箱命中；邮箱纳入自动同步运行键，避免切换邮箱后复用旧成功状态
- 2026-08-16 一周日报批量工作台：独立 renderer 模块编排现有生成/保存/飞书单条接口，按日期×项目维护可编辑草稿并按工作内容估算工时；不新增数据库/飞书协议
- 2026-08-16 项目周反思 v1：跨数据库、AI、IPC 与 renderer；采用通用反思表和日期范围，为已确认的月/年扩展避免迁表，但本轮只实现周反思
- 2026-08-16 周反思动作闭环：红区 Refactor/Feature；状态与 AI 结果分离，紧邻上一期作为受控上下文，置信度 0.93
- 2026-08-21 一周日报保存失败：Vue 响应式结果直接进入 Electron IPC，结构化克隆抛出 DataCloneError；采用统一普通对象 payload 边界修复，置信度 0.98
- 2026-08-22 会议汇报周报：设计已冻结，跨数据库、AI、IPC 和 renderer；独立周报表复用有效日报来源，置信度 0.96
- 2026-09-19 应用补丁版本升级：绿色通道 Chore，仅同步 package 清单版本 3.8.1 → 3.8.2，置信度 0.99

## 验收入口

- `npm run test:weekly-summary`（6/6 + 页面 smoke 通过）
- `npm run test:weekly-reflection`（11/11 + 页面 smoke 通过）
- `npm run typecheck`（通过）
- `npm run build`（通过）
- `npm test`（48/48 + 两个页面 smoke 通过）
- `git diff --check`（通过，仅行尾转换提示）

## 变更边界

- 允许：周报领域模型、独立存储、AI 生成、IPC/preload、页面、历史、来源、复制导出和专项测试
- 禁止：修改飞书 payload、现有单日/一周日报/周反思/自动同步语义；实现月报或年度总结

## 交付证据

- 会议汇报周报：专项 6/6 + 页面 smoke、全量测试、typecheck、build、diff check 全部通过；未执行真实 AI/Electron 生成联调。
- 本轮 Bugfix：一周日报深层 Proxy IPC 回归测试 13/13、全量测试 48/48、typecheck、build、diff check 通过；独立 Review Pass 1 = PASS
- 最终证据：周反思 11/11、全量 48/48、两个页面 smoke、typecheck、build、diff check 全部通过
- Electron 证据：真实 AI 跨周生成成功；上一期动作复盘 3/3、重复问题 2 条、页面状态和 Markdown 持久化通过
