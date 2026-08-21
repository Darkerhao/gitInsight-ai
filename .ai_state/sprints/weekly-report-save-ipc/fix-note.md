# 修复记录

## 根因

一周日报保存 payload 直接携带 Vue 响应式 `timeRange/rawInput/structuredJson`。Electron IPC 无法结构化克隆 Proxy，在请求到达主进程前抛出 `DataCloneError`；发布动作依赖先保存脏草稿，因此飞书提交同时被阻断。

## 修改

- 新增统一的日报 IPC payload 转换模块，将时间范围、原始输入和结构化元数据复制为普通对象。
- 一周日报保存复用该转换模块，不改变保存字段、数据库 schema 或飞书协议。
- 单日日报原有转换迁入同一模块，删除重复实现。
- 新增回归测试：用 Proxy 模拟 Vue 响应式日报结果，并在保存 API mock 中执行 `structuredClone(payload)`。

## 改前复现

```text
node --input-type=module -e <Vue reactive + structuredClone harness>
DataCloneError: #<Object> could not be cloned.
```

## 改后验证

```text
npm run test:weekly-report
13 tests passed; deep Proxy IPC regression passed; weekly report page smoke: pass

npm run typecheck
exit code 0

npm run build
main/preload/renderer production build complete

git diff --check
exit code 0; only existing LF/CRLF conversion warnings
```

## Review

- 独立审查发现初始测试未覆盖 `structuredJson` 深层 Proxy；已补齐顶层、数组与 `workItems` 元素的 Proxy 场景。
- 修复后专项测试、类型检查与 diff check 重新通过，Review Pass 1 = PASS。

## 影响范围

仅 renderer 构造日报保存 IPC payload 的边界与对应测试。数据库、飞书提交数据结构、日报生成逻辑和 UI 均未改变。
