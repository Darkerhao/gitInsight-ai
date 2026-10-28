import type { Database } from 'sql.js';
import type {
  CheckinCoinSpendPayload, CheckinResult, CheckinWallet,
  CheckinWalletImportPayload, CheckinWalletSnapshot,
} from '../../src/shared/types.js';
import { getDatabase, persistDatabase } from './database.js';
import { shiftDateString, toLocalDateString } from './dateUtils.js';
import { sendToMainWindow } from './windows.js';

const DAILY_CHECKIN_REWARD_MIN = 88888;
const DAILY_CHECKIN_REWARD_MAX = 888888;
let walletWrites: Promise<unknown> = Promise.resolve();

type CoinEntry = { type: 'checkin' | 'spend' | 'import' | 'reward'; amount: number; reason: string; refKey?: string };
type WalletChange = { wallet: CheckinWallet; entry?: CoinEntry; undo?: () => void };

function normalizeCoins(value: unknown) {
  const coins = Math.floor(Number(value));
  return Number.isFinite(coins) ? Math.max(0, coins) : 0;
}

function normalizeDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function readWallet(db: Database): CheckinWallet | null {
  const query = db.prepare('SELECT * FROM checkin_wallet WHERE id = 1');
  try {
    if (!query.step()) return null;
    const row = query.getAsObject();
    return { coins: normalizeCoins(row.coins), lastCheckinDate: normalizeDate(row.last_checkin_date),
      streak: normalizeCoins(row.streak), updatedAt: String(row.updated_at || '') };
  } finally { query.free(); }
}

function writeWallet(db: Database, wallet: CheckinWallet) {
  db.run(`INSERT OR REPLACE INTO checkin_wallet (id, coins, last_checkin_date, streak, updated_at)
    VALUES (1, ?, ?, ?, ?)`, [wallet.coins, wallet.lastCheckinDate, wallet.streak, wallet.updatedAt]);
}

function buildSnapshot(wallet: CheckinWallet): CheckinWalletSnapshot {
  const today = toLocalDateString();
  return { wallet, today, checkedInToday: wallet.lastCheckinDate === today };
}

// Every coin writer uses this queue; each synchronous SQL change commits before sql.js export closes the DB.
// On a disk failure, compensate only the changed wallet/asset rows, preserving concurrent report writes.
export function mutateCheckinWallet(change: (db: Database, wallet: CheckinWallet, now: string) => WalletChange): Promise<CheckinWalletSnapshot> {
  const run = walletWrites.then(async () => {
    const db = await getDatabase();
    const previous = readWallet(db);
    const now = new Date().toISOString();
    const wallet = previous ?? { coins: 0, lastCheckinDate: '', streak: 0, updatedAt: now };
    let mutation: WalletChange;
    let transactionId: number | null = null;
    db.run('BEGIN');
    try {
      mutation = change(db, wallet, now);
      writeWallet(db, mutation.wallet);
      if (mutation.entry) {
        const entry = mutation.entry;
        db.run(`INSERT INTO checkin_coin_transactions (type,amount,balance_after,reason,ref_key,created_at)
          VALUES (?,?,?,?,?,?)`, [entry.type, entry.amount, mutation.wallet.coins, entry.reason, entry.refKey ?? null, now]);
        transactionId = Number(db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
      }
      db.run('COMMIT');
    } catch (error) { db.run('ROLLBACK'); throw error; }
    try {
      await persistDatabase();
    } catch (error) {
      db.run('BEGIN');
      try {
        if (previous) writeWallet(db, previous);
        else db.run('DELETE FROM checkin_wallet WHERE id = 1');
        if (transactionId !== null) db.run('DELETE FROM checkin_coin_transactions WHERE id = ?', [transactionId]);
        mutation.undo?.();
        db.run('COMMIT');
      } catch (rollbackError) { db.run('ROLLBACK'); throw rollbackError; }
      // A coalesced persistence loop may have written an earlier version before failing.
      // Write the compensation when possible; persistent disk errors still reject the original operation.
      await persistDatabase().catch(() => {});
      throw error;
    }
    const snapshot = buildSnapshot(mutation.wallet);
    sendToMainWindow('checkin-wallet:updated', snapshot);
    return snapshot;
  });
  walletWrites = run.catch(() => {});
  return run;
}

export async function getOrCreateCheckinWallet(): Promise<CheckinWallet> {
  await walletWrites;
  const existing = readWallet(await getDatabase());
  if (existing) return existing;
  return (await mutateCheckinWallet((_db, wallet) => ({ wallet }))).wallet;
}

export async function getCheckinWalletSnapshot(): Promise<CheckinWalletSnapshot> {
  return buildSnapshot(await getOrCreateCheckinWallet());
}

export function importCheckinWallet(payload: CheckinWalletImportPayload): Promise<CheckinWalletSnapshot> {
  return mutateCheckinWallet((_db, wallet, now) => {
    const coins = normalizeCoins(payload.coins);
    const lastCheckinDate = normalizeDate(payload.lastCheckinDate);
    const streak = normalizeCoins(payload.streak);
    if (wallet.coins > 0 || wallet.lastCheckinDate || wallet.streak > 0 || (!coins && !lastCheckinDate && !streak)) return { wallet };
    return { wallet: { coins, lastCheckinDate, streak: lastCheckinDate ? streak : 0, updatedAt: now },
      entry: coins ? { type: 'import', amount: coins, reason: '迁移本地码币钱包', refKey: 'localStorage' } : undefined };
  });
}

export async function runDailyCheckin(): Promise<CheckinResult> {
  let rewardCoins = 0;
  const snapshot = await mutateCheckinWallet((_db, wallet, now) => {
    const today = toLocalDateString();
    if (wallet.lastCheckinDate === today) return { wallet };
    rewardCoins = Math.floor(Math.random() * (DAILY_CHECKIN_REWARD_MAX - DAILY_CHECKIN_REWARD_MIN + 1)) + DAILY_CHECKIN_REWARD_MIN;
    return { wallet: { coins: wallet.coins + rewardCoins, lastCheckinDate: today,
      streak: wallet.lastCheckinDate === shiftDateString(today, -1) ? wallet.streak + 1 : 1, updatedAt: now },
      entry: { type: 'checkin', amount: rewardCoins, reason: '每日签到', refKey: today } };
  });
  return { ...snapshot, rewardCoins };
}

export function spendCheckinCoins(payload: CheckinCoinSpendPayload): Promise<CheckinWalletSnapshot> {
  return mutateCheckinWallet((_db, wallet, now) => {
    const amount = normalizeCoins(payload.amount);
    if (amount <= 0) throw new Error('码币消费金额必须大于 0');
    if (wallet.coins < amount) throw new Error(`码币不足，还差 ${amount - wallet.coins}`);
    return { wallet: { ...wallet, coins: wallet.coins - amount, updatedAt: now },
      entry: { type: 'spend', amount: -amount, reason: payload.reason?.trim() || '码币消费', refKey: payload.refKey } };
  });
}

export function awardCheckinCoins(payload: { amount: number; reason: string; refKey?: string }): Promise<CheckinWalletSnapshot> {
  return mutateCheckinWallet((_db, wallet, now) => {
    const amount = normalizeCoins(payload.amount);
    if (amount <= 0) throw new Error('码币奖励金额必须大于 0');
    return { wallet: { ...wallet, coins: wallet.coins + amount, updatedAt: now },
      entry: { type: 'reward', amount, reason: payload.reason?.trim() || '码币奖励', refKey: payload.refKey } };
  });
}
