import type {
  CheckinCoinSpendPayload,
  CheckinResult,
  CheckinWallet,
  CheckinWalletImportPayload,
  CheckinWalletSnapshot,
} from '../../src/shared/types.js';
import { getDatabase, persistDatabase } from './database.js';
import { shiftDateString, toLocalDateString } from './dateUtils.js';
import { sendToMainWindow } from './windows.js';

const DAILY_CHECKIN_REWARD_MIN = 88888;
const DAILY_CHECKIN_REWARD_MAX = 888888;

function normalizeCoins(value: unknown) {
  const coins = Math.floor(Number(value));
  return Number.isFinite(coins) ? Math.max(0, coins) : 0;
}

function normalizeStreak(value: unknown) {
  const streak = Math.floor(Number(value));
  return Number.isFinite(streak) ? Math.max(0, streak) : 0;
}

function normalizeDate(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function rowToCheckinWallet(row: Record<string, unknown>): CheckinWallet {
  return {
    coins: normalizeCoins(row.coins),
    lastCheckinDate: normalizeDate(row.last_checkin_date),
    streak: normalizeStreak(row.streak),
    updatedAt: String(row.updated_at || ''),
  };
}

function getDailyCheckinReward() {
  return Math.floor(Math.random() * (DAILY_CHECKIN_REWARD_MAX - DAILY_CHECKIN_REWARD_MIN + 1)) + DAILY_CHECKIN_REWARD_MIN;
}

function buildSnapshot(wallet: CheckinWallet): CheckinWalletSnapshot {
  const today = toLocalDateString();
  return {
    wallet,
    today,
    checkedInToday: wallet.lastCheckinDate === today,
  };
}

async function insertCoinTransaction(payload: {
  type: 'checkin' | 'spend' | 'import' | 'reward';
  amount: number;
  balanceAfter: number;
  reason: string;
  refKey?: string;
  createdAt: string;
}) {
  const db = await getDatabase();
  db.run(
    `INSERT INTO checkin_coin_transactions
      (type, amount, balance_after, reason, ref_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.type, payload.amount, payload.balanceAfter, payload.reason, payload.refKey ?? null, payload.createdAt],
  );
}

function broadcastWallet(snapshot: CheckinWalletSnapshot) {
  sendToMainWindow('checkin-wallet:updated', snapshot);
}

export async function getOrCreateCheckinWallet(): Promise<CheckinWallet> {
  const db = await getDatabase();
  const query = db.prepare('SELECT * FROM checkin_wallet WHERE id = 1 LIMIT 1');
  try {
    if (query.step()) return rowToCheckinWallet(query.getAsObject());
  } finally {
    query.free();
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO checkin_wallet
      (id, coins, last_checkin_date, streak, updated_at)
     VALUES (1, 0, '', 0, ?)`,
    [now],
  );
  await persistDatabase();
  return { coins: 0, lastCheckinDate: '', streak: 0, updatedAt: now };
}

export async function getCheckinWalletSnapshot(): Promise<CheckinWalletSnapshot> {
  return buildSnapshot(await getOrCreateCheckinWallet());
}

export async function importCheckinWallet(payload: CheckinWalletImportPayload): Promise<CheckinWalletSnapshot> {
  const wallet = await getOrCreateCheckinWallet();
  const importedCoins = normalizeCoins(payload.coins);
  const importedLastCheckinDate = normalizeDate(payload.lastCheckinDate);
  const importedStreak = normalizeStreak(payload.streak);

  if (!importedCoins && !importedLastCheckinDate && !importedStreak) {
    return buildSnapshot(wallet);
  }

  const walletHasExistingData = wallet.coins > 0 || Boolean(wallet.lastCheckinDate) || wallet.streak > 0;
  if (walletHasExistingData) {
    return buildSnapshot(wallet);
  }

  const now = new Date().toISOString();
  const importedWallet: CheckinWallet = {
    coins: importedCoins,
    lastCheckinDate: importedLastCheckinDate,
    streak: importedLastCheckinDate ? importedStreak : 0,
    updatedAt: now,
  };
  const db = await getDatabase();
  db.run(
    `UPDATE checkin_wallet
     SET coins = ?, last_checkin_date = ?, streak = ?, updated_at = ?
     WHERE id = 1`,
    [importedWallet.coins, importedWallet.lastCheckinDate, importedWallet.streak, now],
  );
  if (importedWallet.coins > 0) {
    await insertCoinTransaction({
      type: 'import',
      amount: importedWallet.coins,
      balanceAfter: importedWallet.coins,
      reason: '迁移本地甲币钱包',
      refKey: 'localStorage',
      createdAt: now,
    });
  }
  await persistDatabase();
  const snapshot = buildSnapshot(importedWallet);
  broadcastWallet(snapshot);
  return snapshot;
}

export async function runDailyCheckin(): Promise<CheckinResult> {
  const wallet = await getOrCreateCheckinWallet();
  const today = toLocalDateString();
  if (wallet.lastCheckinDate === today) {
    return { ...buildSnapshot(wallet), rewardCoins: 0 };
  }

  const yesterday = shiftDateString(today, -1);
  const rewardCoins = getDailyCheckinReward();
  const now = new Date().toISOString();
  const nextWallet: CheckinWallet = {
    coins: wallet.coins + rewardCoins,
    lastCheckinDate: today,
    streak: wallet.lastCheckinDate === yesterday ? wallet.streak + 1 : 1,
    updatedAt: now,
  };
  const db = await getDatabase();
  db.run(
    `UPDATE checkin_wallet
     SET coins = ?, last_checkin_date = ?, streak = ?, updated_at = ?
     WHERE id = 1`,
    [nextWallet.coins, nextWallet.lastCheckinDate, nextWallet.streak, now],
  );
  await insertCoinTransaction({
    type: 'checkin',
    amount: rewardCoins,
    balanceAfter: nextWallet.coins,
    reason: '每日签到',
    refKey: today,
    createdAt: now,
  });
  await persistDatabase();
  const result = { ...buildSnapshot(nextWallet), rewardCoins };
  broadcastWallet(result);
  return result;
}

export async function spendCheckinCoins(payload: CheckinCoinSpendPayload): Promise<CheckinWalletSnapshot> {
  const amount = normalizeCoins(payload.amount);
  if (amount <= 0) throw new Error('甲币消费金额必须大于 0');

  const wallet = await getOrCreateCheckinWallet();
  if (wallet.coins < amount) {
    throw new Error(`甲币不足，还差 ${amount - wallet.coins}`);
  }

  const now = new Date().toISOString();
  const nextWallet: CheckinWallet = {
    ...wallet,
    coins: wallet.coins - amount,
    updatedAt: now,
  };
  const db = await getDatabase();
  db.run(
    `UPDATE checkin_wallet
     SET coins = ?, updated_at = ?
     WHERE id = 1`,
    [nextWallet.coins, now],
  );
  await insertCoinTransaction({
    type: 'spend',
    amount: -amount,
    balanceAfter: nextWallet.coins,
    reason: (typeof payload.reason === 'string' ? payload.reason.trim() : '') || '甲币消费',
    refKey: payload.refKey,
    createdAt: now,
  });
  await persistDatabase();
  const snapshot = buildSnapshot(nextWallet);
  broadcastWallet(snapshot);
  return snapshot;
}

export async function awardCheckinCoins(payload: {
  amount: number;
  reason: string;
  refKey?: string;
}): Promise<CheckinWalletSnapshot> {
  const amount = normalizeCoins(payload.amount);
  if (amount <= 0) throw new Error('甲币奖励金额必须大于 0');

  const wallet = await getOrCreateCheckinWallet();
  const now = new Date().toISOString();
  const nextWallet: CheckinWallet = {
    ...wallet,
    coins: wallet.coins + amount,
    updatedAt: now,
  };
  const db = await getDatabase();
  db.run(
    `UPDATE checkin_wallet
     SET coins = ?, updated_at = ?
     WHERE id = 1`,
    [nextWallet.coins, now],
  );
  await insertCoinTransaction({
    type: 'reward',
    amount,
    balanceAfter: nextWallet.coins,
    reason: (typeof payload.reason === 'string' ? payload.reason.trim() : '') || '甲币奖励',
    refKey: payload.refKey,
    createdAt: now,
  });
  await persistDatabase();
  const snapshot = buildSnapshot(nextWallet);
  broadcastWallet(snapshot);
  return snapshot;
}
