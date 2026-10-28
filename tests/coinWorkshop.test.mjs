import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs';
import * as files from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { compileFunction } from 'node:vm';
import ts from 'typescript';
import initSqlJs from 'sql.js';

process.env.TZ = 'Asia/Shanghai';
const require = createRequire(import.meta.url);
const project = path.resolve(import.meta.dirname, '..');

async function setup(t, existingDirectory, initialize = true) {
  const directory = existingDirectory ?? await files.mkdtemp(path.join(tmpdir(), 'gitinsight-coins-'));
  if (!existingDirectory) t.after(() => files.rm(directory, { recursive: true, force: true }));
  const SQL = await initSqlJs();
  const state = { fail: false, broadcasts: [], now: '2026-10-28T02:00:00.000Z', filename: path.join(directory, 'export.gitinsight-backup') };
  const RealDate = Date;
  class Clock extends RealDate {
    constructor(...args) { super(...(args.length ? args : [state.now])); }
    static now() { return new RealDate(state.now).getTime(); }
  }
  const electron = {
    app: { getPath: () => directory, getVersion: () => 'test', relaunch() {}, exit() {} },
    dialog: {
      showSaveDialog: async () => ({ canceled: false, filePath: state.filename }),
      showOpenDialog: async () => ({ canceled: false, filePaths: [state.filename] }),
      showMessageBox: async () => ({ response: 0 }),
    },
    safeStorage: { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() },
  };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(project, filename);
    if (cache.has(filename)) return cache.get(filename);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } });
    const exports = {};
    cache.set(filename, exports);
    compileFunction(outputText, ['require', 'exports', 'Date'])((specifier) => {
      if (specifier === 'electron') return electron;
      if (specifier === 'sql.js') return async () => SQL;
      if (specifier === 'node:fs/promises') return { ...files, async rename(from, to) {
        if (state.fail && to === path.join(directory, 'gitinsight.db')) throw new Error('disk unavailable');
        return files.rename(from, to);
      } };
      if (specifier === './windows.js') return { sendToMainWindow: (...args) => state.broadcasts.push(args) };
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(filename), specifier.replace(/\.js$/, '.ts')));
      return require(specifier);
    }, exports, Clock);
    return exports;
  }
  const database = load('electron/main/database.ts');
  const wallet = load('electron/main/checkinWallet.ts');
  const shop = load('electron/main/coinWorkshop.ts');
  t.after(() => database.sqlDatabase?.close());
  if (initialize) await database.getDatabase();
  return { directory, SQL, state, database, wallet, shop, load };
}

async function seed(context, coins = 10000000) {
  await context.wallet.importCheckinWallet({ coins, lastCheckinDate: '2026-10-27', streak: 4 });
}

function addReport(db, date, generatedAt, report = '完成工作', status = 'success') {
  db.run(`INSERT INTO daily_reports (date,reporter_name,repo_names_json,repo_paths_json,report,status,generated_at,updated_at)
    VALUES (?, 'tester', '[]', '[]', ?, ?, ?, ?)`, [date, report, status, generatedAt, generatedAt]);
}

test('existing wallet migrates unchanged and theme purchase charges exactly once including concurrent calls', async t => {
  const c = await setup(t); await seed(c);
  let snapshot = await c.shop.getCoinWorkshop();
  assert.equal(snapshot.wallet.wallet.coins, 10000000);
  assert.ok(snapshot.ownedItemIds.includes('theme-default'));
  const result = await Promise.all([c.shop.purchaseCoinItem('theme-ocean'), c.shop.purchaseCoinItem('theme-ocean')]);
  assert.equal(result[1].wallet.wallet.coins, 9000000);
  snapshot = await c.shop.equipCoinItem('theme-ocean');
  assert.equal(snapshot.equippedThemeId, 'theme-ocean');
  const tx = await c.shop.listCoinTransactions({ type: 'spend' });
  assert.equal(tx.total, 1); assert.equal(tx.records[0].amount, -1000000);
  const restarted = await setup(t, c.directory);
  const restored = await restarted.shop.getCoinWorkshop();
  assert.equal(restored.equippedThemeId, 'theme-ocean');
  assert.equal(restored.wallet.wallet.coins, 9000000);
});

test('invalid products, unowned equipment, and insufficient funds leave balance and ledger untouched', async t => {
  const c = await setup(t); await seed(c, 300000);
  await assert.rejects(c.shop.purchaseCoinItem('theme-ocean'), /不足/);
  await assert.rejects(c.shop.purchaseCoinItem("theme-ocean'; DROP TABLE checkin_wallet;--"), /商品/);
  await assert.rejects(c.shop.equipCoinItem('theme-ocean'), /购买|拥有/);
  await assert.rejects(c.shop.equipCoinItem('seed-clover'), /装扮|装备/);
  assert.equal((await c.shop.getCoinWorkshop()).wallet.wallet.coins, 300000);
  assert.equal((await c.shop.listCoinTransactions({ type: 'spend' })).total, 0);
});

test('card faces unlock permanently at catalog prices and concurrent retries charge once', async t => {
  const c = await setup(t); await seed(c, 3500000);
  const cards = [['card-paper', 500000, '时光纸笺'], ['card-blueprint', 1000000, '工程蓝图'], ['card-orbit', 2000000, '星轨纪念']];
  let balance = 3500000;
  for (const [id, price, name] of cards) {
    await Promise.all([c.shop.purchaseCoinItem(id), c.shop.purchaseCoinItem(id)]);
    balance -= price;
    const snapshot = await c.shop.getCoinWorkshop();
    assert.equal(snapshot.wallet.wallet.coins, balance);
    assert.equal(snapshot.ownedItemIds.filter(itemId => itemId === id).length, 1);
    const transaction = (await c.shop.listCoinTransactions({ type: 'spend' })).records.find(row => row.refKey === id);
    assert.equal(transaction.amount, -price);
    assert.equal(transaction.reason, `购买${name}`);
    await assert.rejects(c.shop.equipCoinItem(id), /装扮|装备/);
    assert.equal((await c.shop.getCoinWorkshop()).equippedPotId, 'pot-default');
  }
  assert.equal((await c.shop.listCoinTransactions({ type: 'spend' })).total, 3);
  const restarted = await setup(t, c.directory);
  const restored = await restarted.shop.getCoinWorkshop();
  assert.equal(restored.wallet.wallet.coins, 0);
  assert.ok(cards.every(([id]) => restored.ownedItemIds.includes(id)));
  await restarted.shop.purchaseCoinItem('card-orbit');
  assert.equal((await restarted.shop.listCoinTransactions({ type: 'spend' })).total, 3);
});

test('card purchase rejects insufficient funds and rolls back all state on persistence failure', async t => {
  const c = await setup(t); await seed(c, 500000);
  await assert.rejects(c.shop.purchaseCoinItem('card-blueprint'), /不足/);
  c.state.fail = true;
  await assert.rejects(c.shop.purchaseCoinItem('card-paper'), /disk unavailable/);
  const snapshot = await c.shop.getCoinWorkshop();
  assert.equal(snapshot.wallet.wallet.coins, 500000);
  assert.ok(!snapshot.ownedItemIds.some(id => id.startsWith('card-')));
  assert.equal((await c.shop.listCoinTransactions({ type: 'spend' })).total, 0);
  c.state.fail = false;
  await c.shop.purchaseCoinItem('card-paper');
  assert.equal((await c.shop.getCoinWorkshop()).wallet.wallet.coins, 0);
  assert.equal((await c.shop.listCoinTransactions({ type: 'spend' })).total, 1);
});

test('wallet writes serialize purchases, normal spending, check-in, and rewards without losing updates', async t => {
  const c = await setup(t); await seed(c, 1400000);
  const [purchase, spend, checkin, reward] = await Promise.allSettled([
    c.shop.purchaseCoinItem('theme-ocean'),
    c.wallet.spendCheckinCoins({ amount: 600000, reason: 'effect' }),
    c.wallet.runDailyCheckin(),
    c.wallet.awardCheckinCoins({ amount: 6666, reason: 'test reward' }),
  ]);
  assert.equal(purchase.status, 'fulfilled'); assert.equal(spend.status, 'rejected');
  assert.equal(checkin.status, 'fulfilled'); assert.equal(reward.status, 'fulfilled');
  assert.equal((await c.shop.getCoinWorkshop()).wallet.wallet.coins, 400000 + checkin.value.rewardCoins + 6666);
  const db = await c.database.getDatabase();
  assert.equal(db.exec('SELECT coins=(SELECT SUM(amount) FROM checkin_coin_transactions) FROM checkin_wallet')[0].values[0][0], 1);
});

test('concurrent seed purchases cannot exceed three slots and reject before charging', async t => {
  const c = await setup(t); await seed(c);
  const results = await Promise.allSettled(Array.from({ length: 4 }, () => c.shop.purchaseCoinItem('seed-clover')));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
  const snapshot = await c.shop.getCoinWorkshop();
  assert.equal(snapshot.plants.length, 3); assert.equal(snapshot.wallet.wallet.coins, 9400000);
});

test('growth counts unique valid work dates after planting and collection releases a slot without minting coins', async t => {
  const c = await setup(t); await seed(c);
  let snapshot = await c.shop.purchaseCoinItem('seed-clover');
  const plant = snapshot.plants[0]; const db = await c.database.getDatabase();
  addReport(db, '2026-10-27', '2026-10-29T03:00:00.000Z');
  addReport(db, '2026-10-28', '2026-10-27T03:00:00.000Z');
  addReport(db, '2026-10-28', '2026-10-27T03:00:00.000Z', '先生成、种下后才保存');
  db.run("UPDATE daily_reports SET updated_at='2026-10-28T03:00:00.000Z' WHERE report='先生成、种下后才保存'");
  addReport(db, '2026-10-28', '2026-10-28T03:00:00.000Z');
  addReport(db, '2026-10-28', '2026-10-28T04:00:00.000Z');
  addReport(db, '2026-10-29', '2026-10-29T03:00:00.000Z', '  ');
  addReport(db, '2026-10-29', '2026-10-29T03:00:00.000Z', 'failed', 'failed');
  addReport(db, '2026-11-01', '2026-10-28T03:00:00.000Z');
  c.state.now = '2026-10-29T08:00:00.000Z';
  assert.equal((await c.shop.getCoinWorkshop()).plants[0].growthDays, 1);
  await assert.rejects(c.shop.harvestCoinPlant(plant.id), /成熟/);
  addReport(db, '2026-10-29', '2026-10-29T03:00:00.000Z');
  addReport(db, '2026-10-30', '2026-10-30T03:00:00.000Z');
  c.state.now = '2026-10-30T08:00:00.000Z';
  snapshot = await c.shop.harvestCoinPlant(plant.id);
  assert.ok(snapshot.plants[0].harvestedAt); assert.equal(snapshot.wallet.wallet.coins, 9800000);
  assert.equal((await c.shop.listCoinTransactions()).total, 2);
  const duplicate = await c.shop.harvestCoinPlant(plant.id);
  assert.equal(duplicate.plants[0].harvestedAt, snapshot.plants[0].harvestedAt);
  await c.shop.purchaseCoinItem('seed-clover');
  assert.equal((await c.shop.getCoinWorkshop()).plants.filter(p => !p.harvestedAt).length, 1);
});

test('garden ignores work dates with only spaces, newlines or tabs in saved reports', async t => {
  const c = await setup(t); await seed(c);
  await c.shop.purchaseCoinItem('seed-clover');
  const db = await c.database.getDatabase();
  addReport(db, '2026-10-29', '2026-10-29T03:00:00.000Z', '\r\n');
  addReport(db, '2026-10-30', '2026-10-30T03:00:00.000Z', '\t');
  addReport(db, '2026-10-31', '2026-10-31T03:00:00.000Z', ' \t\r\n ');
  c.state.now = '2026-10-31T08:00:00.000Z';
  assert.equal((await c.shop.getCoinWorkshop()).plants[0].growthDays, 0);
  addReport(db, '2026-10-28', '2026-10-28T03:00:00.000Z', '\t完成工作\r\n');
  assert.equal((await c.shop.getCoinWorkshop()).plants[0].growthDays, 1);
});

test('ledger summary uses local day boundaries and filtered pagination stays complete', async t => {
  const c = await setup(t); await seed(c);
  const db = await c.database.getDatabase();
  db.run("UPDATE checkin_coin_transactions SET created_at='2026-10-26T23:00:00.000Z'");
  await c.shop.purchaseCoinItem('seed-clover');
  await c.shop.purchaseCoinItem('pot-ceramic');
  await c.wallet.awardCheckinCoins({ amount: 100, reason: 'test' });
  c.state.now = '2026-10-27T16:30:00.000Z';
  db.run("UPDATE checkin_coin_transactions SET created_at='2026-10-27T16:15:00.000Z' WHERE amount=100");
  const snapshot = await c.shop.getCoinWorkshop();
  assert.deepEqual(snapshot.summary, { todayIncome: 100, todaySpent: 700000, totalIncome: 10000100, totalSpent: 700000 });
  const first = await c.shop.listCoinTransactions({ type: 'spend', pageSize: 1 });
  const second = await c.shop.listCoinTransactions({ type: 'spend', pageSize: 1, page: 2 });
  assert.equal(first.total, 2); assert.equal(first.records[0].amount, -500000); assert.equal(second.records[0].amount, -200000);
  assert.equal((await c.shop.listCoinTransactions({ type: 'income' })).total, 2);
});

test('failed persistence rolls back purchase and equipment and permits a safe retry', async t => {
  const c = await setup(t); await seed(c);
  const broadcasts = c.state.broadcasts.length; c.state.fail = true;
  await assert.rejects(c.shop.purchaseCoinItem('theme-ocean'), /disk unavailable/);
  assert.equal(c.state.broadcasts.length, broadcasts);
  assert.equal((await c.shop.getCoinWorkshop()).wallet.wallet.coins, 10000000);
  assert.ok(!(await c.shop.getCoinWorkshop()).ownedItemIds.includes('theme-ocean'));
  c.state.fail = false;
  await c.shop.purchaseCoinItem('theme-ocean');
  c.state.fail = true;
  await assert.rejects(c.shop.equipCoinItem('theme-ocean'), /disk unavailable/);
  assert.equal((await c.shop.getCoinWorkshop()).equippedThemeId, 'theme-default');
  c.state.fail = false;
  await c.shop.equipCoinItem('theme-ocean');
  const restarted = await setup(t, c.directory);
  assert.equal((await restarted.shop.getCoinWorkshop()).equippedThemeId, 'theme-ocean');
});

test('portable backups preserve workshop assets and accept old backups without workshop tables', async t => {
  const c = await setup(t); await seed(c);
  const config = c.load('electron/main/config.ts'); await config.saveConfig(config.normalizeConfig({}));
  await c.shop.purchaseCoinItem('theme-ocean'); await c.shop.equipCoinItem('theme-ocean');
  await c.shop.purchaseCoinItem('seed-clover');
  const backup = c.load('electron/main/backup.ts'); await backup.exportDataBackup();
  const exported = JSON.parse(await files.readFile(c.state.filename, 'utf8'));
  await c.shop.equipCoinItem('theme-default');
  await backup.restoreDataBackup();
  const restored = await setup(t, c.directory, false);
  await restored.load('electron/main/backup.ts').applyPendingRestore();
  const restoredWorkshop = await restored.shop.getCoinWorkshop();
  assert.equal(restoredWorkshop.equippedThemeId, 'theme-ocean');
  assert.equal(restoredWorkshop.plants.length, 1);
  assert.equal(restoredWorkshop.wallet.wallet.coins, 8800000);
  const saved = new c.SQL.Database(Buffer.from(exported.database, 'base64'));
  assert.equal(saved.exec('SELECT COUNT(*) FROM coin_workshop_items')[0].values[0][0], 1);
  assert.equal(saved.exec('SELECT COUNT(*) FROM coin_garden_plants')[0].values[0][0], 1);
  saved.run('DROP TABLE coin_workshop_items; DROP TABLE coin_workshop_settings; DROP TABLE coin_garden_plants');
  exported.database = Buffer.from(saved.export()).toString('base64'); saved.close();
  await files.writeFile(c.state.filename, JSON.stringify(exported));
  await restored.load('electron/main/backup.ts').restoreDataBackup();
});
