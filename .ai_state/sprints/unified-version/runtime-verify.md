# 版本整合运行验证

## 测试场景

- `npm run check`：类型检查与生产构建通过；保留既有依赖注释警告。
- 系统 Chrome 全量 renderer E2E：44/44 通过。最后修改后复跑素材、合篇、导航 16/16 通过，覆盖无仓库素材生成、失败保留、历史续编、发布前保存、任务日历、来源明细、复制目录和双主题 900/1366 宽度。
- `node tests/desktopRuntime.smoke.cjs`：真实 Electron 37.10.3、真实 preload/IPC、隔离配置目录；main 旧 role_materials 表迁移、两类素材生成/持久化、数据库重启、加密凭据、单实例拒绝、备份恢复及原始快照保留均通过。
- 新素材 8 项 node:test 与合篇 8 项动作回归通过。原周报 23/23 通过。
- 全量单测首次暴露两个依赖旧硬编码路由字符串的源码断言，删除其重复路由检查，实际路由已由浏览器 heading/navigation 回归覆盖。
- 随后全量运行的旧 networkRequest 用例一次返回 `fetch failed`，该实现本轮未改；单独复跑 5/5 通过。完整复跑退出码 0：14 组共 178 项，fail 0（`tests-complete.log`）。
- 最终审查 P2：历史续编未确认便替换未保存草稿。两条新增 E2E 修复前因缺少确认按钮失败（history-guard-red.log）；修复后合篇 5/5 通过（history-guard-green.log），验证取消保留正文、素材、日期、范围、汇报人与仓库，以及确认恢复历史。改后历史单测 6/6、`npm run check` 退出码 0（check-review-fix.log）。

## 实现证据

- 原生子任务 unified-ui、unified-material、unified-report 在独立工作树完成；主线程仅同步各自明确拥有的文件。当前桌面工具未写入安装态 SubagentStart hook 记录，未伪造该记录，以原生任务结果、实际 diff 与测试结果为证据。
- root 当前分支为 feature/unified-version。本地合并提交双父分别为 `800e5ce354e6737dc4668c47c60d3a2d273079aa` 与 `07abbac45f8ab70563fb3945f2b6a9f0f1dec400`；两个原分支 SHA 不变，两次 `git merge-base --is-ancestor` 均返回 0。语义整合以新版为基础重接 main 独有能力，最终文档包含在本地合并提交中。

## 验证边界

- renderer E2E 使用 IPC 测试数据；未真实提交飞书。
- Electron 测试关闭外网并隔离所有数据，没有打开可见窗口或操作用户配置。
- 没有推送 GitHub、发布安装包或执行真实跨平台安装。
- 原始日志在被忽略的 `.cache/unified-version/`，页面截图在 `output/playwright/unified-pages/`。
