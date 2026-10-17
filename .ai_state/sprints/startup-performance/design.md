# 第一轮启动与响应优化

## Scope

- 基线：6a633d0，当前 dev 工作区干净。隔离工作区：D:/MyWork/project/SHUZHI/gitInsight-ai/.cache/worktrees/startup-performance。
- 已确认：启动不等待仓库扫描、首屏页面按需加载与生产 JS 压缩、移除页面退出等待、增加可复跑分段计时。
- 保留现有配置、飞书关联、日报草稿、恢复/备份/更新行为。不新增依赖，不迁移数据库，不改变 Git/AI 业务协议。

## Round 1 · Design

1. 配置加载后用已保存的 selected/pinned 仓库路径恢复初始仓库信息，名称通过现有规则解析；不建立第二套持久化缓存。
2. 本地配置/数据可用后返回 init，扫描与现有飞书元数据在后台执行。后台扫描只更新仓库发现信息，不覆盖用户当前选择、配置编辑、删除操作；旧工作区或已 dispose/retry 的结果不能回写。显式刷新继续提供完整扫描/清理行为。
3. 保留单一 repos/selectedRepoPaths 状态。必要的请求版本属于异步操作生命周期，不建立重复业务状态。扫描失败可见并可重试；不得清空已恢复的仓库。自动恢复不触发配置保存或消除未保存标记。
4. App 的 viewMap 使用 Vue defineAsyncComponent；共享 ReportConfig 组件复用同一实例定义。只加载当前页面，保留上次路由。提供明确的加载/失败重试状态；不预加载全部页面，不使用全局 KeepAlive。
5. renderer 生产构建启用 esbuild 压缩；保留现有必要分块并验证真实静态依赖闭包，避免 vendor 分块把 ECharts/3D 拉回首屏。首轮不新增自动按需导入插件。
6. 去除 out-in 退出等待，移除无用 leave 样式，保留最多 100ms 的进入淡入和 reduced-motion。切换后旧页面及时卸载。
7. 使用标准 Performance API 对 main 入口、app ready、恢复/配置/IPC/window 阶段，以及 renderer 入口、配置、本地就绪、扫描、当前页面挂载分段计时。不把指标显示在产品流程，不记录路径、账号或内容，不增加业务 IPC/数据库。
8. 实测分清全进程启动、首次页面挂载、后台扫描与页面切换。隐藏窗口不提供真实可见冷启动数据；前次隐藏窗口动画计时无效，不作为速度对比。资源基线为生产入口静态 JS 闭包 5,986,293 bytes。

## Acceptance Criteria

- AC1: 扫描 Promise 永不完成时，init 仍完成，已有已选仓库与本地页面可用；失败保留已恢复信息并可再次刷新。
- AC2: 后台扫描结束不覆盖扫描期间的用户选择/删除/配置编辑；dispose、重试或工作区变更后旧扫描不回写；启动不写配置。
- AC3: 默认日报页首屏静态依赖不包含 ECharts/3D；所有现有页面仍可打开，上次路由可恢复；资源加载失败有可见重试入口。
- AC4: 路由不再等待旧页面离场；短进入动画与 reduced-motion 生效，现有草稿与导航行为无回归。
- AC5: 生产 JS 首屏体积相对基线下降；存在可复跑启动计时命令与阶段指标，报告测量环境，不承诺安装包真实冷启动已达到 1 秒。
- AC6: 类型检查、构建、可靠性与导航/仓库/日报回归通过，真实隔离 Electron 启动验证通过，无新增依赖和无关改动。

## Done Contract

- node --test tests/assistantInitialization.test.mjs tests/repositoryFeishu.test.mjs tests/autoSyncEditing.test.mjs：通过，包含延迟扫描交互回归。
- npm run check、npm run test:reliability：通过。
- 现有 Playwright 导航/仓库/日报测试及本轮必要行为回归通过；浏览器前置缺失时优先使用已安装 Chrome，并说明环境。
- npm run test:desktop：通过；本轮计时脚本打印有阶段名的数值结果，并报告生产入口依赖体积。
- git diff --check：通过；代码/规格审查与收敛检查通过，架构现状文档更新。

## Round 1 · Critic Findings

独立审查服务未能执行：指定 critic 模型返回 503 无渠道，默认模型返回 token rate limit。没有独立 PASS 结论。用户重复要求继续，由主会话直接实施与复核，并如实记录此限制。
主会话复核：后台扫描不得占用日报生成共用 loading；旧扫描必须失效；懒加载失败必须可重试；隐藏窗口动画时间不得作为真实启动指标。
