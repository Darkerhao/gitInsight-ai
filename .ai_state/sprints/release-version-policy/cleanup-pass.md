# 收敛检查

- 删除固定 patch 路径，只保留 release-version.mjs 一个版本策略；无新增依赖、环境配置或 AI 服务。
- 独立只读复审检查了调试痕迹、必要注释、重复实现、效率和过度设计；正式 JSON 预览输出保留。
- 历史补丁仅在候选提交含 feat 或破坏性标记时批量计算，不逐提交启动 Git。
- 更新发布说明、README、CLAUDE 和架构，清除旧的固定 patch 及 dev push 检查表述。
- 保留 report-performance 主任务状态及原有 .claude/settings.local.json，不提交或推送。
