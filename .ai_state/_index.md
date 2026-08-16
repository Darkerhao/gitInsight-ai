# AI State Index

本轮唯一入口：一周日报批量工作台——按日期和多个项目生成、编辑并提交日报。

## 当前路由

- stage: review（实现与运行验证已完成，进入最终双轴审查）
- route: 红区 / shared 工时纯函数与 renderer 新页面 Feature
- design: 复用既有生成、保存和飞书单条接口；日期×项目草稿按日分配工时
- writer: 主线程直做（保留现有未跟踪 worktree 元数据）
- confidence: 0.94

## route_history

- 2026-07-25 Signal Atelier UI：黄区 renderer Feature，已 ship（14 测试+smoke+typecheck+build 全绿）
- 2026-08-04 多任务自动同步：分诊确认现状为全局单例配置（autoSync.ts 单跑单提交）→ 提供 A（单条多明细行）/B（多任务调度）两案 → 用户选 B → 红区 worktree 写者；升级日幂等靠运行键格式不变
- 2026-08-10 多任务自动同步：写者完成多任务核心/调度/IPC/UI/迁移并集成；核心测试、typecheck、build、npm test、diff check 全绿；UI smoke 与未改造基线同因既有奖励组件 emoji 断言失败
- 2026-08-16 日报配置 Git 边界：将基础配置拆为 Git 提交采集与日报/同步两组，并在自动同步的统计窗口/统计仓库处补充 Git 标记；未改动配置模型或业务调用链
- 2026-08-16 Git 作者邮箱匹配：Git 日志采集 author email，筛选支持名称或邮箱命中；邮箱纳入自动同步运行键，避免切换邮箱后复用旧成功状态
- 2026-08-16 一周日报批量工作台：独立 renderer 模块编排现有生成/保存/飞书单条接口，按日期×项目维护可编辑草稿并按工作内容估算工时；不新增数据库/飞书协议

## 验收入口

- `npm run typecheck`（通过）
- `npm run build`（通过；仅有既有 Element Plus PURE 注释告警）
- `npm run test:weekly-report`（12/12 + 页面 smoke 通过）
- `npm test`（35/35 通过）
- `git diff --check`（通过）

## 变更边界

- 允许：一周日报页面、导航、页面编排、草稿动作、共享工时纯函数和专项测试
- 禁止：修改飞书 payload、数据库 schema、现有单日日报与自动同步语义

## 交付证据

- 变更文件：shared 周报纯函数、renderer 周报页面/编排/动作/样式、导航和专项测试
- 运行验证：周报专项 12/12 + smoke、全量 35/35、typecheck、build、diff check
- 运行限制：既有 UI shell smoke 基线失败；无授权飞书账号和可写数据，未执行真实提交
