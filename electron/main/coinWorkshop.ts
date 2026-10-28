import type { Database } from 'sql.js';
import { COIN_SHOP_ITEMS } from '../../src/shared/coinWorkshop.js';
import type { CoinGardenPlant, CoinShopItem, CoinTransactionPage, CoinTransactionQuery, CoinWorkshopSnapshot } from '../../src/shared/coinWorkshop.js';
import { getDatabase } from './database.js';
import { getCheckinWalletSnapshot, mutateCheckinWallet } from './checkinWallet.js';
import { toLocalDateString, shiftDateString } from './dateUtils.js';

type Params = Array<string | number | null>;
function rows(db: Database, sql: string, params: Params = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    const result: Record<string, unknown>[] = [];
    while (statement.step()) result.push(statement.getAsObject());
    return result;
  } finally { statement.free(); }
}

function itemById(itemId: string): CoinShopItem {
  const item = COIN_SHOP_ITEMS.find(item => item.id === itemId);
  if (!item) throw new Error('商品不存在');
  return item;
}

function owned(db: Database, item: CoinShopItem) {
  return item.price === 0 || rows(db, 'SELECT item_id FROM coin_workshop_items WHERE item_id = ?', [item.id]).length > 0;
}

function readPlants(db: Database): CoinGardenPlant[] {
  return rows(db, `SELECT plants.*, (
      SELECT COUNT(DISTINCT date) FROM daily_reports
      WHERE date >= plants.planted_date AND date <= ? AND updated_at >= plants.planted_at
        AND updated_at <= ? AND status <> 'failed' AND length(trim(report, char(32) || char(13) || char(10) || char(9))) > 0
    ) AS growth_days FROM coin_garden_plants plants ORDER BY id DESC`, [toLocalDateString(), new Date().toISOString()])
    .map(row => ({ id: Number(row.id), seedId: String(row.seed_id), plantedAt: String(row.planted_at),
      harvestedAt: row.harvested_at ? String(row.harvested_at) : null,
      growthDays: Math.min(Number(row.growth_days), Number(row.required_days)), requiredDays: Number(row.required_days) }));
}

export async function getCoinWorkshop(): Promise<CoinWorkshopSnapshot> {
  const wallet = await getCheckinWalletSnapshot();
  const db = await getDatabase();
  const settings = rows(db, 'SELECT * FROM coin_workshop_settings WHERE id = 1')[0];
  const today = toLocalDateString();
  const start = new Date(`${today}T00:00:00`).toISOString();
  const end = new Date(`${shiftDateString(today, 1)}T00:00:00`).toISOString();
  const summary = rows(db, `SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END),0) AS income,
    COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END),0) AS spent,
    COALESCE(SUM(CASE WHEN amount > 0 AND created_at >= ? AND created_at < ? THEN amount ELSE 0 END),0) AS today_income,
    COALESCE(SUM(CASE WHEN amount < 0 AND created_at >= ? AND created_at < ? THEN -amount ELSE 0 END),0) AS today_spent
    FROM checkin_coin_transactions`, [start, end, start, end])[0];
  return {
    wallet,
    ownedItemIds: [...COIN_SHOP_ITEMS.filter(item => item.price === 0).map(item => item.id),
      ...rows(db, 'SELECT item_id FROM coin_workshop_items ORDER BY purchased_at, item_id').map(row => String(row.item_id))],
    equippedThemeId: String(settings.theme_id), equippedPotId: String(settings.pot_id), plants: readPlants(db),
    summary: { todayIncome: Number(summary.today_income), todaySpent: Number(summary.today_spent),
      totalIncome: Number(summary.income), totalSpent: Number(summary.spent) },
  };
}

export async function purchaseCoinItem(itemId: string): Promise<CoinWorkshopSnapshot> {
  const item = itemById(itemId);
  await mutateCheckinWallet((db, wallet, now) => {
    if (item.kind !== 'seed' && owned(db, item)) return { wallet };
    if (wallet.coins < item.price) throw new Error(`码币不足，还差 ${item.price - wallet.coins}`);
    let undo: () => void;
    if (item.kind === 'seed') {
      const active = Number(rows(db, 'SELECT COUNT(*) AS count FROM coin_garden_plants WHERE harvested_at IS NULL')[0].count);
      if (active >= 3) throw new Error('三个生长位已满，请先收藏成熟植物');
      db.run('INSERT INTO coin_garden_plants (seed_id,planted_at,planted_date,required_days) VALUES (?,?,?,?)',
        [item.id, now, toLocalDateString(), item.growthDays!]);
      const id = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
      undo = () => { db.run('DELETE FROM coin_garden_plants WHERE id = ?', [id]); };
    } else {
      db.run('INSERT INTO coin_workshop_items (item_id,purchased_at) VALUES (?,?)', [item.id, now]);
      undo = () => { db.run('DELETE FROM coin_workshop_items WHERE item_id = ?', [item.id]); };
    }
    return { wallet: { ...wallet, coins: wallet.coins - item.price, updatedAt: now }, undo,
      entry: { type: 'spend', amount: -item.price, reason: `${item.kind === 'seed' ? '种下' : '购买'}${item.name}`, refKey: item.id } };
  });
  return getCoinWorkshop();
}

export async function equipCoinItem(itemId: string): Promise<CoinWorkshopSnapshot> {
  const item = itemById(itemId);
  if (item.kind === 'seed') throw new Error('种子不能作为装扮装备');
  await mutateCheckinWallet((db, wallet) => {
    if (!owned(db, item)) throw new Error('请先购买该装扮');
    const column = item.kind === 'theme' ? 'theme_id' : 'pot_id';
    const previous = String(rows(db, `SELECT ${column} AS value FROM coin_workshop_settings WHERE id = 1`)[0].value);
    db.run(`UPDATE coin_workshop_settings SET ${column} = ? WHERE id = 1`, [item.id]);
    return { wallet, undo: () => { db.run(`UPDATE coin_workshop_settings SET ${column} = ? WHERE id = 1`, [previous]); } };
  });
  return getCoinWorkshop();
}

export async function harvestCoinPlant(plantId: number): Promise<CoinWorkshopSnapshot> {
  if (!Number.isSafeInteger(plantId) || plantId <= 0) throw new Error('植物编号无效');
  await mutateCheckinWallet((db, wallet, now) => {
    const plant = readPlants(db).find(plant => plant.id === plantId);
    if (!plant) throw new Error('植物不存在');
    if (plant.harvestedAt) return { wallet };
    if (plant.growthDays < plant.requiredDays) throw new Error('植物还未成熟');
    db.run('UPDATE coin_garden_plants SET harvested_at = ? WHERE id = ?', [now, plantId]);
    return { wallet, undo: () => { db.run('UPDATE coin_garden_plants SET harvested_at = NULL WHERE id = ?', [plantId]); } };
  });
  return getCoinWorkshop();
}

export async function listCoinTransactions(query: CoinTransactionQuery = {}): Promise<CoinTransactionPage> {
  await getCheckinWalletSnapshot();
  const db = await getDatabase();
  const pageSize = Number.isFinite(query.pageSize) ? Math.min(100, Math.max(1, Math.floor(query.pageSize!))) : 10;
  const requestedPage = Number.isFinite(query.page) ? Math.max(1, Math.floor(query.page!)) : 1;
  const where = query.type === 'income' ? 'WHERE amount > 0' : query.type === 'spend' ? 'WHERE amount < 0' : '';
  const total = Number(rows(db, `SELECT COUNT(*) AS count FROM checkin_coin_transactions ${where}`)[0].count);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / pageSize)));
  const records = rows(db, `SELECT * FROM checkin_coin_transactions ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [pageSize, (page - 1) * pageSize])
    .map(row => ({ id: Number(row.id), type: String(row.type), amount: Number(row.amount), balanceAfter: Number(row.balance_after),
      reason: String(row.reason), refKey: row.ref_key === null ? null : String(row.ref_key), createdAt: String(row.created_at) }));
  return { records, total, page, pageSize };
}
