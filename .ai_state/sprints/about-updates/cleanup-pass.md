# Cleanup Pass

- 临时调试代码：无生产调试输出、临时 updater 或测试开关；安装拦截仅存在于测试脚本。
- 关键注释：解释官方退出钩子注册时机、app.exit 路径和 renderer 乱序响应保护。
- 冗余：移除旧 about→system 映射及无消费者的 about-* 全局样式，只保留新的关于页面实现。
- 低效模式：检查与下载均去重，后台单一定时器，复用项目已有原子写入与事件发送。
- 复杂度：只增加 electron-updater 一个直接运行依赖，不自建下载/签名/安装机制，不改变业务配置和备份格式。

独立只读 polish 结论：PASS。Sass 编译后结构对比确认，两个清理文件中帮助/消息等其他选择器及声明完全一致。

现有架构与发布文档已更新。改动已无冲突同步回原工作区，依赖锁文件与已审查 worktree 完全一致；没有提交或发布。

原工作区最终验证：165 项单测、28 项浏览器回归、5 项真实 updater 场景、原 desktop smoke、类型检查与构建均通过；最终 Windows 安装包已验证。

环境限制：删除临时 worktree 的受控清理命令被自动审批拒绝（仅返回 blocked by policy），因此保留 `.cache/worktrees/about-updates`。没有执行替代删除或改动原有其他 worktree。
