# Improvement Proposals

## 2026-07-25 Signal Atelier

- 为 renderer 建立仓库内、无需联网的浏览器 QA harness，显式 mock preload 契约并标注“非 Electron 运行时”，避免每次临时注入。
- 将 `tests/ui-shell.smoke.mjs` 接入项目 `check` 脚本，使 Lucide、无 emoji、reduced-motion 与阶段交互契约成为默认门禁。
- 后续若需要验证 IPC 交互，增加独立 Electron smoke；不要扩大本次表现层 Feature 的范围。
