import type {
  JiaziFarmHarvestPayload,
  JiaziFarmHarvestRecord,
  JiaziFarmResourceType,
  JiaziFarmSnapshot,
  JiaziFarmState,
  JiaziFarmTask,
  JiaziFarmTaskPayload,
} from '../../src/shared/types.js';
import { getDatabase, persistDatabase } from './database.js';
import { toLocalDateString } from './dateUtils.js';

const GROWTH_TO_HARVEST = 100;
const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const CROP_NAMES = ['日报稻', '代码麦', '协作花', '灵感树'];

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

function getCropName(level: number) {
  return CROP_NAMES[Math.max(0, level - 1) % CROP_NAMES.length];
}

function rowToFarmState(row: Record<string, unknown>): JiaziFarmState {
  return {
    cycleStartDate: String(row.cycle_start_date || ''),
    water: Number(row.water) || 0,
    sunlight: Number(row.sunlight) || 0,
    nutrient: Number(row.nutrient) || 0,
    growth: Number(row.growth) || 0,
    level: Number(row.level) || 1,
    totalHarvests: Number(row.total_harvests) || 0,
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

async function getOrCreateFarmState(date: string) {
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
      (id, cycle_start_date, water, sunlight, nutrient, growth, level, total_harvests, updated_at)
     VALUES (1, ?, 0, 0, 0, 0, 1, 0, ?)`,
    [date, now],
  );
  await persistDatabase();
  return {
    cycleStartDate: date,
    water: 0,
    sunlight: 0,
    nutrient: 0,
    growth: 0,
    level: 1,
    totalHarvests: 0,
    updatedAt: now,
  };
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

export async function getJiaziFarmSnapshot(dateValue?: string): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(dateValue);
  const state = await getOrCreateFarmState(date);
  const cycleDay = getCycleDay(state.cycleStartDate, date);
  const [tasks, harvestRecords] = await Promise.all([buildTasks(date), listHarvestRecords()]);

  return {
    date,
    state,
    tasks,
    harvestRecords,
    ganzhiName: getGanzhiName(cycleDay),
    cycleDay,
    seasonLabel: getSeasonLabel(cycleDay),
    cropName: getCropName(state.level),
    canHarvest: state.growth >= GROWTH_TO_HARVEST,
  };
}

export async function claimJiaziFarmTask(payload: JiaziFarmTaskPayload): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const snapshot = await getJiaziFarmSnapshot(date);
  const task = snapshot.tasks.find((item) => item.key === payload.taskKey);
  if (!task) throw new Error('未找到对应的甲子农事任务');
  if (!task.available) throw new Error('今日条件尚未达成，暂不能领取该农事奖励');
  if (task.claimed) throw new Error('该农事奖励今日已领取');

  const resourceColumnMap: Record<JiaziFarmResourceType, 'water' | 'sunlight' | 'nutrient'> = {
    water: 'water',
    sunlight: 'sunlight',
    nutrient: 'nutrient',
  };
  const resourceColumn = resourceColumnMap[task.resourceType];
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
    `UPDATE jiazi_farm_state
     SET ${resourceColumn} = ${resourceColumn} + ?,
         growth = growth + ?,
         updated_at = ?
     WHERE id = 1`,
    [task.rewardAmount, task.growthAmount, now],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}

export async function harvestJiaziFarm(payload: JiaziFarmHarvestPayload = {}): Promise<JiaziFarmSnapshot> {
  const date = normalizeFarmDate(payload.date);
  const snapshot = await getJiaziFarmSnapshot(date);
  if (!snapshot.canHarvest) throw new Error('作物尚未成熟，继续完成今日农事即可收获');

  const now = new Date().toISOString();
  const currentState = snapshot.state;
  const nextLevel = currentState.level + 1;
  const resourcesSummary: Partial<Record<JiaziFarmResourceType, number>> = {
    water: currentState.water,
    sunlight: currentState.sunlight,
    nutrient: currentState.nutrient,
  };
  const db = await getDatabase();

  db.run(
    `INSERT INTO jiazi_farm_harvests
      (date, ganzhi_name, crop_name, level, resources_summary_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, snapshot.ganzhiName, snapshot.cropName, nextLevel, JSON.stringify(resourcesSummary), now],
  );
  db.run(
    `UPDATE jiazi_farm_state
     SET growth = growth - ?,
         level = ?,
         total_harvests = total_harvests + 1,
         updated_at = ?
     WHERE id = 1`,
    [GROWTH_TO_HARVEST, nextLevel, now],
  );
  await persistDatabase();
  return getJiaziFarmSnapshot(date);
}
