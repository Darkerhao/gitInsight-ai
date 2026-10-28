# 码币工坊

## 调用边界

`CoinWorkshopView.vue` → `useCoinWorkshop.ts` → 固定 preload API → `electron/main/ipc.ts` → `coinWorkshop.ts` / `checkinWallet.ts` → SQLite。

`src/shared/coinWorkshop.ts` 是商品、价格及工坊契约的唯一来源。主进程接收商品 ID，不接受客户端定价；永久物品重复购买不扣币。种子购买即种植，生长位上限三个。购买与装备分开，装备不收费。

## 数据与写入

| 数据 | 持有者 |
|---|---|
| 余额、签到日期、连续签到 | `checkin_wallet` |
| 全部收支及每笔余额 | `checkin_coin_transactions` |
| 已购买永久装扮 | `coin_workshop_items` |
| 当前主题和花盆 | `coin_workshop_settings` 单例 |
| 种植时间、本地种植日、成熟天数、收藏时间 | `coin_garden_plants` |

所有钱包写入共用 `mutateCheckinWallet` 队列。修改余额、流水和对应资产的同步事务先提交，再调用现有持久化。失败时恢复本次钱包值、删除本次流水并补偿本次资产或装备，不用整库快照覆盖同期日报；成功后广播原有钱包更新事件。

花园成长读取 `daily_reports`，按有效业务日期去重，要求日期位于种植本地日到今天之间，保存时间不早于种植且不在未来、状态非失败、正文去空格及换行/Tab 后非空。成熟收藏不发币，植物继续保留在图鉴。

收支统计复用原流水；今日区间为本地零点到次日零点转换的 UTC ISO 边界。明细按记录 ID 降序，支持全部/收入/支出与分页。

## 界面与恢复

App 持有单一工坊快照生命周期，监听钱包更新；工坊页共享该快照并按需读明细。付费主题覆盖应用与 Element Plus 现有颜色变量；默认主题移除覆盖，让原有明暗配色生效。花盆同时用于生长中与已收藏植物。

备份沿用完整 SQLite，新表作为可选结构校验；旧备份没有新表仍可恢复，初始化补齐默认装备与空资产。实际 IPC、重启及备份恢复验证见 [运行记录](../sprints/coin-workshop/runtime-verify.md)。

工作纪念卡复用永久商品和时间长河数据，筛选及预览仅为界面状态。共享 SVG 生成器提供预览与矢量导出；PNG 在 renderer 使用原生 Canvas 将该 SVG 转为两倍分辨率图片。两种导出共用解锁和有效数据检查，不新增 IPC、存储或依赖。
