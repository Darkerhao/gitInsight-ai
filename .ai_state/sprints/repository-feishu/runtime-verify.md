# 运行验证

## 测试场景

- 配置：旧数据缺关联字段、规范化持久化重载、刷新保留、移除清理、设置保存失败和重试。
- 草稿：关联优先于全局、默认工时、明确手选和主动清空、历史恢复、默认草稿随关联增删更新。
- 发布：失败保存保留已提交状态；单日/批量提交使用关联 ID 和名称；合篇混合目标留空。
- 飞书：切换表单清空旧选项/草稿目标并保留内容；便携备份不携带关联令牌，旧 v1 备份继续恢复。
- 界面：添加多个仓库后逐项关联、名称编辑、搜索、清空、错误重试、选择/置顶/移除；深浅主题及 900/1366px 页面回归。

## 已完成验证

- 当前 checkout：npm run check，退出码 0。
- 隔离 checkout：Chrome 41/41 E2E 通过，覆盖 repository-projects、reports、combined-report、unified-navigation。
- 截图：output/playwright/repository-projects-dark.png、repository-projects-light.png，已人工查看。
- Chromium 缺少所需 headless executable，使用本机 Chrome；不将首次无法启动计入浏览器测试通过。
- 完整单测曾暴露 NodeNext 相对导入和旧测试桩导入清单问题，已按实际模块依赖修复；当前 checkout 最终 npm test 退出码 0，192/192 Node 测试及既有页面 smoke 通过，见 .cache/repository-current-unit.log。

## 边界

- 浏览器运行真实 Vue 页面，模拟 Electron IPC；未执行真实飞书发布或安装包验证。
- 原生 spawn 未输出 PACE SubagentStart hook，writer 在只读阶段停止；未伪造事件，主线程单写者在隔离目录完成实现。
- 独立只读审查完成；原工作台变更在任务期间由其他操作提交，本次合入保留这些变更。
