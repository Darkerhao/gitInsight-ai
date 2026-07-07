import type {
  JiaziFarmCropTier,
  JiaziFarmHarvestPayload,
  JiaziFarmHarvestRecord,
  JiaziFarmPlantPayload,
  JiaziFarmPlot,
  JiaziFarmPlotUnlock,
  JiaziFarmQuickRipenPayload,
  JiaziFarmResourceType,
  JiaziFarmSnapshot,
  JiaziFarmState,
  JiaziFarmTask,
  JiaziFarmTaskPayload,
  JiaziFarmWaterPayload,
} from '../../src/shared/types.js';
import { awardCheckinCoins, getOrCreateCheckinWallet, spendCheckinCoins } from './checkinWallet.js';
import { getDatabase, persistDatabase } from './database.js';
import { toLocalDateString } from './dateUtils.js';

const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 作物等级树（farm-wide 线性解锁）。tier 从 1 起，name/收获线/反哺甲币/解锁花费均在此声明 */
const CROP_TIERS: Array<{ tier: number; name: string; growthToHarvest: number; harvestReward: number; unlockCost: number }> = [
  { tier: 1, name: '日报稻', growthToHarvest: 100, harvestReward: 6_666, unlockCost: 0 },
  { tier: 2, name: '代码麦', growthToHarvest: 160, harvestReward: 18_888, unlockCost: 60_000 },
  { tier: 3, name: '协作花', growthToHarvest: 240, harvestReward: 48_888, unlockCost: 280_000 },
  { tier: 4, name: '灵感树', growthToHarvest: 360, harvestReward: 108_888, unlockCost: 888_000 },
];

/** 地块解锁花费；slot 1 默认拥有，最多 4 块 */
const PLOT_UNLOCK_COSTS: Record<number, number> = { 1: 0, 2: 88_888, 3: 288_888, 4: 888_888 };
const MAX_PLOTS = 4;

/** 浇灌一次的花费与增益（一种资源 +resourceAmount，同时 +growthAmount 成长） */
const WATER_PACK = { cost: 8_888, resourceAmount: 25, growthAmount: 20 };

/** 一键催熟：每点成长单价，花费 = (收获线 − 当前成长) × 单价 */
const COIN_PER_GROWTH = 888;

type FarmTaskDefinition = Omit<JiaziFarmTask, 'available' | 'claimed' | 'claimedAt'> & {
  availability: 'always' | 'daily-report' | 'feishu-sync' | 'git-activity';
};

const TASK_DEFINITIONS: FarmTaskDefinition[] = [
  {
    key: 'daily_visit',
    title: '每日入园',
    description: '打开甲子农场，完成一次今日巡田。',
    resourceType: 'water',
    rewardAmount: 6,
    growthAmount: 6,
    availability: 'always',
  },
  {
    key: 'report_generated',
    title: '沉淀日报',
    description: '今日已有日报记录，可为作物补充阳光。',
    resourceType: 'sunlight',
    rewardAmount: 12,
    growthAmount: 12,
    availability: 'daily-report',
  },
  {
    key: 'feishu_synced',
    title: '同步飞书',
    description: '今日已有飞书同步成功记录，可补充露水。',
    resourceType: 'water',
    rewardAmount: 12,
    growthAmount: 12,
    availability: 'feishu-sync',
  },
  {
    key: 'git_activity',
    title: '代码耕作',
    description: '今日日报记录包含有效提交，可补充养分。',
    resourceType: 'nutrient',
    rewardAmount: 10,
    growthAmount: 10,
    availability: 'git-activity',
  },
];

const RESOURCE_COLUMN_MAP: Record<JiaziFarmResourceType, 'water' | 'sunlight' | 'nutrient'> = {
  water: 'water',
  sunlight: 'sunlight',
  nutrient: 'nutrient',
};

function normalizeFarmDate(date?: string) {
  const value = date?.trim();
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toLocalDateString();
}

function parseDateMs(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function diffDays(startDate: string, endDate: string) {
  return Math.floor((parseDateMs(endDate) - parseDateMs(startDate)) / 86_400_000);
}

function getCycleDay(cycleStartDate: string, date: string) {
  const offset = diffDays(cycleStartDate, date);
  return ((offset % 60) + 60) % 60 + 1;
}

function getGanzhiName(cycleDay: number) {
  const index = cycleDay - 1;
  return `${HEAVENLY_STEMS[index % HEAVENLY_STEMS.length]}${EARTHLY_BRANCHES[index % EARTHLY_BRANCHES.length]}`;
}

function getSeasonLabel(cycleDay: number) {
  if (cycleDay <= 15) return '春耕';
  if (cycleDay <= 30) return '夏长';
  if (cycleDay <= 45) return '秋收';
  return '冬藏';
}

/** 取指定档次的作物定义，越界回落到已定义的两端 */
function getCropTierDef(tier: number) {
  const clamped = Math.max(1, Math.min(CROP_TIERS.length, Math.floor(Number(tier) || 1)));
  return CROP_TIERS[clamped - 1];
}

function rowToFarmState(row: Record<string, unknown>): JiaziFarmState {
  return {
    cycleStartDate: String(row.cycle_start_date || ''),
    unlockedCropTier: Math.max(1, Number(row.unlocked_crop_tier) || 1),
    unlockedPlotCount: Math.max(1, Number(row.unlocked_plot_count) || 1),
    updatedAt: String(row.updated_at || ''),
  };
}

function rowToFarmPlot(row: Record<string, unknown>): JiaziFarmPlot {
  const cropTier = Math.max(1, Number(row.crop_tier) || 1);
  const cropDef = getCropTierDef(cropTier);
  const growth = Number(row.growth) || 0;
  const level = Math.max(1, Number(row.level) || 1);
  return {
    slot: Number(row.slot) || 1,
    cropTier,
    cropName: cropDef.name,
    water: Number(row.water) || 0,
    sunlight: Number(row.sunlight) || 0,
    nutrient: Number(row.nutrient) || 0,
    growth,
    level,
    totalHarvests: Number(row.total_harvests) || 0,
    growthToHarvest: cropDef.growthToHarvest,
    canHarvest: growth >= cropDef.growthToHarvest,
    harvestReward: cropDef.harvestReward * level,
    updatedAt: String(row.updated_at || ''),
  };
}

function rowToHarvestRecord(row: Record<string, unknown>): JiaziFarmHarvestRecord {
  let resourcesSummary: JiaziFarmHarvestRecord['resourcesSummary'] = {};
  try {
    const parsed = JSON.parse(String(row.resources_summary_json || '{}')) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      resourcesSummary = parsed as JiaziFarmHarvestRecord['resourcesSummary'];
    }
  } catch {
    resourcesSummary = {};
  }

  return {
    id: Number(row.id) || 0,
    date: String(row.date || ''),
    ganzhiName: String(row.ganzhi_name || ''),
    cropName: String(row.crop_name || ''),
    level: Number(row.level) || 1,
    resourcesSummary,
    createdAt: String(row.created_at || ''),
  };
}

async function getOrCreateFarmState(date: string): Promise<JiaziFarmState> {
  const db = await getDatabase();
  const query = db.prepare('SELECT * FROM jiazi_farm_state WHERE id = 1 LIMIT 1');
  try {
    if (query.step()) return rowToFarmState(query.getAsObject());
  } finally {
    query.free();
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO jiazi_farm_state
      (id, cycle_start_date, water, sunlight, nutrient, growth, level, total_harvests, unlocked_crop_tier, unlocked_plot_count, updated_at)
     VALUES (1, ?, 0, 0, 0, 0, 1, 0, 1, 1, ?)`,
    [date, now],
  );
  await persistDatabase();
  return { cycleStartDate: date, unlockedCropTier: 1, unlockedPlotCount: 1, updatedAt: now };
}

async function getOrCreatePlot(slot: number): Promise<JiaziFarmPlot> {
  const db = await getDatabase();
  const query = db.prepare('SELECT * FROM jiazi_farm_plots WHERE slot = ? LIMIT 1');
  try {
    query.bind([slot]);
    if (query.step()) return rowToFarmPlot(query.getAsObject());
  } finally {
    query.free();
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO jiazi_farm_plots
      (slot, crop_tier, water, sunlight, nutrient, growth, level, total_harvests, updated_at)
     VALUES (?, 1, 0, 0, 0, 0, 1, 0, ?)`,
    [slot, now],
  );
  await persistDatabase();
  return rowToFarmPlot({ slot, crop_tier: 1, water: 0, sunlight: 0, nutrient: 0, growth: 0, level: 1, total_harvests: 0, updated_at: now });
}

/** 读出已解锁的全部地块（不足则补建），按 slot 升序 */
async function listPlots(unlockedPlotCount: number): Promise<JiaziFarmPlot[]> {
  const plots: JiaziFarmPlot[] = [];
  for (let slot = 1; slot <= unlockedPlotCount; slot += 1) {
    plots.push(await getOrCreatePlot(slot));
  }
  return plots;
}

async function getClaimedTaskMap(date: string) {
  const db = await getDatabase();
  const statement = db.prepare('SELECT task_key, claimed_at FROM jiazi_farm_task_claims WHERE date = ?');
  const result = new Map<string, string>();
  try {
    statement.bind([date]);
    while (statement.step()) {
      const row = statement.getAsObject();
      result.set(String(row.task_key || ''), String(row.claimed_at || ''));
    }
  } finally {
    statement.free();
  }
  return result;
}

async function countRows(sql: string, params: unknown[]) {
  const db = await getDatabase();
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    return statement.step() ? Number(statement.getAsObject().count) || 0 : 0;
  } finally {
    statement.free();
  }
}

async function getCommitCount(date: string) {
  const db = await getDatabase();
  const statement = db.prepare('SELECT COALESCE(SUM(commits_count), 0) AS count FROM daily_reports WHERE date = ?');
  try {
    statement.bind([date]);
    return statement.step() ? Number(statement.getAsObject().count) || 0 : 0;
  } finally {
    statement.free();
  }
}

async function getAvailabilityMap(date: string) {
  const [reportCount, syncCount, commitCount] = await Promise.all([
    countRows('SELECT COUNT(*) AS count FROM daily_reports WHERE date = ?', [date]),
    countRows("SELECT COUNT(*) AS count FROM sync_logs WHERE date = ? AND status = 'success'", [date]),
    getCommitCount(date),
  ]);

  return {
    always: true,
    'daily-report': reportCount > 0,
    'feishu-sync': syncCount > 0,
    'git-activity': commitCount > 0,
  } satisfies Record<FarmTaskDefinition['availability'], boolean>;
}

async function buildTasks(date: string) {
  const [claimedTaskMap, availabilityMap] = await Promise.all([
    getClaimedTaskMap(date),
    getAvailabilityMap(date),
  ]);

  return TASK_DEFINITIONS.map((task) => ({
    key: task.key,
    title: task.title,
    description: task.description,
    resourceType: task.resourceType,
    rewardAmount: task.rewardAmount,
    growthAmount: task.growthAmount,
    available: availabilityMap[task.availability],
    claimed: claimedTaskMap.has(task.key),
    claimedAt: claimedTaskMap.get(task.key) ?? '',
  }));
}

async function listHarvestRecords(limit = 8) {
  const db = await getDatabase();
  const statement = db.prepare('SELECT * FROM jiazi_farm_harvests ORDER BY created_at DESC LIMIT ?');
  const records: JiaziFarmHarvestRecord[] = [];
  try {
    statement.bind([Math.max(1, Math.min(Number(limit) || 8, 50))]);
    while (statement.step()) {
      records.push(rowToHarvestRecord(statement.getAsObject()));
    }
  } finally {
    statement.free();
  }
  return records;
}

function buildCropTiers(unlockedCropTier: number, coins: number): JiaziFarmCropTier[] {
  return CROP_TIERS.map((def) => {
    const unlocked = def.tier <= unlockedCropTier;
    return {
      tier: def.tier,
      name: def.name,
      growthToHarvest: def.growthToHarvest,
      harvestReward: def.harvestReward,
      unlockCost: def.unlockCost,
      unlocked,
      // 只有「下一档」可购买，且余额足够
      canAfford: !unlocked && def.tier === unlockedCropTier + 1 && coins >= def.unlockCost,
    };
  });
}

function buildPlotUnlock(unlockedPlotCount: number, coins: number): JiaziFarmPlotUnlock {
  const maxed = unlockedPlotCount >= MAX_PLOTS;
  const nextSlot = unlockedPlotCount + 1;
  const cost = maxed ? 0 : PLOT_UNLOCK_COSTS[nextSlot] ?? 0;
  return {
    nextSlot: maxed ? unlockedPlotCount : nextSlot,
    cost,
    canAfford: !maxed && coins >= cost,
    maxed,
  };
}

export async function getJiaziFarmSnapshot(dateValue?: string): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(dateValue);
  const state = await getOrCreateFarmState(date);
  const cycleDay = getCycleDay(state.cycleStartDate, date);
  const [wallet, plots, tasks, harvestRecords] = await Promise.all([
    getOrCreateCheckinWallet(),
    listPlots(state.unlockedPlotCount),
    buildTasks(date),
    listHarvestRecords(),
  ]);
  const coins = wallet.coins;

  return {
    date,
    state,
    plots,
    cropTiers: buildCropTiers(state.unlockedCropTier, coins),
    plotUnlock: buildPlotUnlock(state.unlockedPlotCount, coins),
    tasks,
    harvestRecords,
    ganzhiName: getGanzhiName(cycleDay),
    cycleDay,
    seasonLabel: getSeasonLabel(cycleDay),
    coins,
    waterPack: { cost: WATER_PACK.cost, resourceAmount: WATER_PACK.resourceAmount, growthAmount: WATER_PACK.growthAmount },
    coinPerGrowth: COIN_PER_GROWTH,
  };
}

/** 校验 plotSlot 已解锁并返回对应地块，否则抛中文错误 */
async function requirePlot(state: JiaziFarmState, plotSlot: number): Promise<JiaziFarmPlot> {
  const slot = Math.floor(Number(plotSlot) || 0);
  if (slot < 1 || slot > state.unlockedPlotCount) {
    throw new Error('该地块尚未解锁');
  }
  return getOrCreatePlot(slot);
}

export async function claimJiaziFarmTask(payload: JiaziFarmTaskPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const state = await getOrCreateFarmState(date);
  const plot = await requirePlot(state, payload.plotSlot);
  const snapshot = await getJiaziFarmSnapshot(date);
  const task = snapshot.tasks.find((item) => item.key === payload.taskKey);
  if (!task) throw new Error('未找到对应的甲子农事任务');
  if (!task.available) throw new Error('今日条件尚未达成，暂不能领取该农事奖励');
  if (task.claimed) throw new Error('该农事奖励今日已领取');

  const resourceColumn = RESOURCE_COLUMN_MAP[task.resourceType];
  const now = new Date().toISOString();
  const db = await getDatabase();

  try {
    db.run(
      `INSERT INTO jiazi_farm_task_claims
        (date, task_key, resource_type, reward_amount, growth_amount, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [date, task.key, task.resourceType, task.rewardAmount, task.growthAmount, now],
    );
  } catch {
    throw new Error('该农事奖励今日已领取');
  }

  db.run(
    `UPDATE jiazi_farm_plots
     SET ${resourceColumn} = ${resourceColumn} + ?,
         growth = growth + ?,
         updated_at = ?
     WHERE slot = ?`,
    [task.rewardAmount, task.growthAmount, now, plot.slot],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function waterPlot(payload: JiaziFarmWaterPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const state = await getOrCreateFarmState(date);
  const plot = await requirePlot(state, payload.plotSlot);
  const resourceColumn = RESOURCE_COLUMN_MAP[payload.resourceType];
  if (!resourceColumn) throw new Error('未知的浇灌资源类型');

  // 先扣币（余额不足会在此抛出中文错误），再施加增益
  await spendCheckinCoins({
    amount: WATER_PACK.cost,
    reason: `甲子农场浇灌·${payload.resourceType}`,
    refKey: `farm-water:${plot.slot}`,
  });

  const now = new Date().toISOString();
  const db = await getDatabase();
  db.run(
    `UPDATE jiazi_farm_plots
     SET ${resourceColumn} = ${resourceColumn} + ?,
         growth = growth + ?,
         updated_at = ?
     WHERE slot = ?`,
    [WATER_PACK.resourceAmount, WATER_PACK.growthAmount, now, plot.slot],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function quickRipenPlot(payload: JiaziFarmQuickRipenPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const state = await getOrCreateFarmState(date);
  const plot = await requirePlot(state, payload.plotSlot);
  const gap = plot.growthToHarvest - plot.growth;
  if (gap <= 0) throw new Error('作物已成熟，无需催熟');

  const cost = gap * COIN_PER_GROWTH;
  await spendCheckinCoins({
    amount: cost,
    reason: '甲子农场一键催熟',
    refKey: `farm-ripen:${plot.slot}`,
  });

  const now = new Date().toISOString();
  const db = await getDatabase();
  db.run(
    `UPDATE jiazi_farm_plots
     SET growth = ?,
         updated_at = ?
     WHERE slot = ?`,
    [plot.growthToHarvest, now, plot.slot],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function plantCrop(payload: JiaziFarmPlantPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const state = await getOrCreateFarmState(date);
  const plot = await requirePlot(state, payload.plotSlot);
  const cropTier = Math.floor(Number(payload.cropTier) || 0);
  if (cropTier < 1 || cropTier > CROP_TIERS.length) throw new Error('未知的作物档次');
  if (cropTier > state.unlockedCropTier) throw new Error('该作物尚未解锁');
  if (cropTier === plot.cropTier) throw new Error('该地块已在种植此作物');

  // 改种会重置成长（重新播种），资源保留
  const now = new Date().toISOString();
  const db = await getDatabase();
  db.run(
    `UPDATE jiazi_farm_plots
     SET crop_tier = ?,
         growth = 0,
         updated_at = ?
     WHERE slot = ?`,
    [cropTier, now, plot.slot],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function unlockCropTier(dateValue?: string): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(dateValue);
  const state = await getOrCreateFarmState(date);
  const nextTier = state.unlockedCropTier + 1;
  if (nextTier > CROP_TIERS.length) throw new Error('已解锁全部作物');

  const def = getCropTierDef(nextTier);
  await spendCheckinCoins({
    amount: def.unlockCost,
    reason: `甲子农场解锁作物·${def.name}`,
    refKey: `farm-crop-tier:${nextTier}`,
  });

  const now = new Date().toISOString();
  const db = await getDatabase();
  db.run('UPDATE jiazi_farm_state SET unlocked_crop_tier = ?, updated_at = ? WHERE id = 1', [nextTier, now]);
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function unlockPlot(dateValue?: string): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(dateValue);
  const state = await getOrCreateFarmState(date);
  if (state.unlockedPlotCount >= MAX_PLOTS) throw new Error('已解锁全部地块');

  const nextSlot = state.unlockedPlotCount + 1;
  const cost = PLOT_UNLOCK_COSTS[nextSlot] ?? 0;
  await spendCheckinCoins({
    amount: cost,
    reason: `甲子农场解锁地块·第 ${nextSlot} 块`,
    refKey: `farm-plot:${nextSlot}`,
  });

  const now = new Date().toISOString();
  const db = await getDatabase();
  db.run('UPDATE jiazi_farm_state SET unlocked_plot_count = ?, updated_at = ? WHERE id = 1', [nextSlot, now]);
  await getOrCreatePlot(nextSlot);
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function harvestJiaziFarm(payload: JiaziFarmHarvestPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const state = await getOrCreateFarmState(date);
  const plot = await requirePlot(state, payload.plotSlot);
  if (!plot.canHarvest) throw new Error('作物尚未成熟，继续完成今日农事或浇灌即可收获');

  const now = new Date().toISOString();
  const nextLevel = plot.level + 1;
  const cycleDay = getCycleDay(state.cycleStartDate, date);
  const ganzhiName = getGanzhiName(cycleDay);
  const resourcesSummary: Partial<Record<JiaziFarmResourceType, number>> = {
    water: plot.water,
    sunlight: plot.sunlight,
    nutrient: plot.nutrient,
  };
  const db = await getDatabase();

  db.run(
    `INSERT INTO jiazi_farm_harvests
      (date, ganzhi_name, crop_name, level, resources_summary_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, ganzhiName, plot.cropName, nextLevel, JSON.stringify(resourcesSummary), now],
  );
  db.run(
    `UPDATE jiazi_farm_plots
     SET growth = growth - ?,
         level = ?,
         total_harvests = total_harvests + 1,
         updated_at = ?
     WHERE slot = ?`,
    [plot.growthToHarvest, nextLevel, now, plot.slot],
  );
  db.run('UPDATE jiazi_farm_state SET updated_at = ? WHERE id = 1', [now]);
  await persistDatabase();

  // 反哺甲币：作物档次基准 × 收获前地块等级（plot.harvestReward 已含 level 系数）
  await awardCheckinCoins({
    amount: plot.harvestReward,
    reason: `甲子农场丰收·${plot.cropName} Lv.${plot.level}`,
    refKey: `farm-harvest:${plot.slot}:${date}`,
  });

  return getJiaziFarmSnapshot(date);
}
