# 码币工坊第一版

2026-10-28。用户授权在新分支完成工作台装扮、代码花园和收支明细。分支 codex/coin-workshop；隔离写入目录 .cache/worktrees/coin-workshop，最终同步当前分支，不提交或发布。

## 范围与取舍

单一 `/coins` 页面，放在成长中心，顶部签到面板增加入口。沿用 Vue、Element Plus、sql.js 和现有码币钱包，不新增依赖。保留余额、签到奖励、特效和明暗主题。新装扮仅改变工作台配色，购买永久拥有，可免费切回默认；不伪装成实物奖励。

代码花园最多三个生长位。购买种子即种下；种下之后保存的有效日报按不同工作日期计一次成长，排除未来日报与空正文，同一日多仓库/反复编辑不能加速。成熟后手动收藏，释放生长位，植物留在图鉴，不发码币。花盆永久购买并全局装备，成熟植物仍可展示。无离线倒计时、浇水状态或第二套收益。

成长依据 daily_reports.updated_at >= plantedAt，业务 date 位于种植本地日与今天之间，按 date 去重，正文去空白后非空。generated_at 可能早于种植但晚保存，不能用生成时间代替保存时间。今日收支使用本地零点到下一零点转换的 UTC ISO 查询区间。

收支明细读取 checkin_coin_transactions，提供今日收入/支出、累计收入/支出，按全部/收入/支出筛选与分页。金额完整保留且千分位显示，不截断账本。

## 固定契约

新增 src/shared/coinWorkshop.ts，定义商品与接口类型，并导出 COIN_SHOP_ITEMS。所有价格和商品校验均由该静态目录定义，主进程不接受客户端价格。

- CoinShopItem: id:string, kind:'theme'|'seed'|'pot', name:string, description:string, price:number, accent?:string, growthDays?:number。
- 商品 ID：theme-default(免费默认，accent #b9f36b)、theme-ocean(1000000，#58c8ed)、theme-lavender(2000000，#b9a0ff)、theme-sunset(3000000，#f5ad73)；seed-clover(200000，3天)、seed-sunflower(400000，5天)、seed-pine(800000，7天)；pot-default(免费)、pot-ceramic(500000)、pot-orbit(1500000)。允许增加展示字段，禁止分裂目录。
- CoinGardenPlant: id:number, seedId:string, plantedAt:string, harvestedAt:string|null, growthDays:number(已成长天数), requiredDays:number。
- CoinWorkshopSnapshot: wallet:CheckinWalletSnapshot, ownedItemIds:string[], equippedThemeId:string, equippedPotId:string, plants:CoinGardenPlant[], summary:{todayIncome:number,todaySpent:number,totalIncome:number,totalSpent:number}。
- CoinTransaction: id:number,type:string,amount:number,balanceAfter:number,reason:string,refKey:string|null,createdAt:string。
- CoinTransactionQuery: page?:number,pageSize?:number,type?:'all'|'income'|'spend'。
- CoinTransactionPage: records:CoinTransaction[],total:number,page:number,pageSize:number。
- window.api.getCoinWorkshop():Promise<CoinWorkshopSnapshot>。
- window.api.purchaseCoinItem(itemId:string):Promise<CoinWorkshopSnapshot>。
- window.api.equipCoinItem(itemId:string):Promise<CoinWorkshopSnapshot>。
- window.api.harvestCoinPlant(plantId:number):Promise<CoinWorkshopSnapshot>。
- window.api.listCoinTransactions(query?:CoinTransactionQuery):Promise<CoinTransactionPage>。

新增 coin_workshop_items（永久物品）、coin_workshop_settings（单例装备）、coin_garden_plants（种植与收藏）三张 SQLite 表。新增表以可选表加入备份校验，兼容旧备份；恢复完整数据库后资产、装备、花园和流水一并恢复。

## 可靠性与验收

购买在主进程校验余额、商品、已有资产和生长位；扣币、入账与发放必须保持一致。并发请求不得重复购买永久物品、超卖余额或超过三个槽位。现有签到/特效与购买共用钱包写入顺序，持久化失败不得误报购买成功。购买后顶栏余额更新，重新加载保留资产和装备。

前端展示加载、错误与重试；购买/装备/收藏有在途状态，失败保留已有数据。主题使用现有 CSS 变量并兼容深浅色与 reduced-motion，不引入图片生成或新图标库。预览和拥有/正在使用状态明确，购买前显示准确金额。

默认主题通过移除装扮覆盖恢复原有深浅色，不硬编码统一默认色。付费主题同步主色/hover/浅色层级及前景色。持久化失败后重新读取内存钱包、资产和流水也应保持旧值，重试只消费一次；禁止用整库快照覆盖并发日报。

测试真实钱包与 SQL 路径：迁移保留旧余额、重复购买/余额不足/并发、植物按真实日报日期成长/重复保存不增加/成熟收藏、流水分页和统计、持久化与备份恢复。类型检查、构建、相关回归、浏览器可见交互及隔离 Electron IPC 验证。所有运行数据隔离，不修改用户真实账本。

## 计划与职责

1. 钱包与资产：后端 worker 负责 shared/coinWorkshop.ts、shared/api.ts、electron/main/coinWorkshop.ts、checkinWallet.ts、database.ts、backup.ts、ipc.ts、electron/preload.ts 和后端专项测试。
2. 页面与装扮：前端 worker 负责 renderer、新增路由导航、样式、测试夹具及浏览器专项测试；严格遵循上述 API。
3. 主线程负责集成、运行验证、独立审查、架构记录及同步。两位 worker 共享隔离目录，不覆盖对方改动。

quantum-codegen 的 Convention Pack 针对另一套工程，当前仓库没有相应 Pack；本轮不使用其脚手架，直接沿用仓库真实 Vue/Electron 约定。
