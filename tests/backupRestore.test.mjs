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

const require = createRequire(import.meta.url);
const project = path.resolve(import.meta.dirname, '..');

async function setup(t, existingDirectory) {
  const directory = existingDirectory ?? await files.mkdtemp(path.join(tmpdir(), 'gitinsight-backup-'));
  if (!existingDirectory) t.after(() => files.rm(directory, { recursive: true, force: true }));
  const SQL = await initSqlJs();
  const state = { filename: path.join(directory, 'export.gitinsight-backup'), cancel: false, confirm: 0, relaunches: 0, failConfigWrite: false };
  const electron = {
    app: { getPath: () => directory, getVersion: () => 'test', relaunch: () => state.relaunches++, exit() {} },
    dialog: {
      showSaveDialog: async () => ({ canceled: state.cancel, filePath: state.filename }),
      showOpenDialog: async () => ({ canceled: state.cancel, filePaths: [state.filename] }),
      showMessageBox: async () => ({ response: state.confirm }),
    },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(value),
      decryptString: value => value.toString(),
    },
  };
  const cache = new Map();
  const mockedFiles = { ...files, async rename(from, to) {
    if (state.failConfigWrite && to === path.join(directory, 'config.json')) throw new Error('injected config replacement failure');
    return files.rename(from, to);
  } };
  function load(filename) {
    filename = path.resolve(project, filename);
    if (cache.has(filename)) return cache.get(filename);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } });
    const exports = {};
    cache.set(filename, exports);
    compileFunction(outputText, ['require', 'exports'])((specifier) => {
      if (specifier === 'electron') return electron;
      if (specifier === 'node:fs/promises') return mockedFiles;
      if (specifier === 'sql.js') return async () => SQL;
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(filename), specifier.replace(/\.js$/, '.ts')));
      return require(specifier);
    }, exports);
    return exports;
  }
  const backup = load('electron/main/backup.ts');
  const config = load('electron/main/config.ts');
  const database = load('electron/main/database.ts');
  t.after(() => database.sqlDatabase?.close());
  return { directory, SQL, state, backup, config, database };
}

async function seed(context) {
  const db = await context.database.getDatabase();
  db.run("CREATE TABLE jiazi_farm_state (value TEXT); INSERT INTO jiazi_farm_state VALUES ('keep history')");
  db.run("INSERT INTO error_logs (scope, message, created_at) VALUES ('test', 'original error', '2026-10-08')");
  await context.database.persistDatabase();
  const config = context.config.normalizeConfig({ reporterName: 'Original reporter', aiApiKey: 'private-ai-key',
    feishuForm: { cookie: 'private-cookie', csrfToken: 'private-csrf', shareToken: 'private-share' },
    autoSync: { enabled: true, tasks: [{ id: 'daily', enabled: true, name: 'Daily' }] } });
  await context.config.saveConfig(config);
}

test('portable backup preserves the full SQLite file, strips credentials, and restores with sync disabled', async t => {
  const context = await setup(t);
  await seed(context);
  const result = await context.backup.exportDataBackup();
  assert.equal(result.canceled, false);
  const raw = await files.readFile(context.state.filename, 'utf8');
  for (const secret of ['private-ai-key', 'private-cookie', 'private-csrf', 'private-share']) assert.equal(raw.includes(secret), false);
  const originalConfig = await files.readFile(path.join(context.directory, 'config.json'));
  const originalSecrets = await files.readFile(path.join(context.directory, 'secrets.json'));
  const originalDatabase = await files.readFile(path.join(context.directory, 'gitinsight.db'));
  await context.backup.restoreDataBackup();
  assert.equal(context.state.relaunches, 1);
  assert.deepEqual(await files.readFile(path.join(context.directory, 'gitinsight.db')), originalDatabase);
  const startup = await setup(t, context.directory);
  await startup.backup.applyPendingRestore();
  const restored = await startup.config.loadConfig();
  assert.equal(restored.reporterName, 'Original reporter');
  assert.equal(restored.aiApiKey, '');
  assert.equal(restored.feishuForm.cookie, '');
  assert.equal(restored.autoSync.enabled, false);
  assert.equal(restored.autoSync.tasks[0].enabled, false);
  const restoredDb = await startup.database.getDatabase();
  assert.equal(restoredDb.exec('SELECT value FROM jiazi_farm_state')[0].values[0][0], 'keep history');
  assert.equal(restoredDb.exec('SELECT message FROM error_logs')[0].values[0][0], 'original error');
  assert.equal(fs.existsSync(path.join(context.directory, 'restore-pending.json')), false);
  const rollbackName = (await files.readdir(context.directory)).find(name => name.startsWith('restore-original-'));
  const rollback = JSON.parse(await files.readFile(path.join(context.directory, rollbackName), 'utf8'));
  assert.deepEqual(Buffer.from(rollback.files.config, 'base64'), originalConfig);
  assert.deepEqual(Buffer.from(rollback.files.secrets, 'base64'), originalSecrets);
  assert.deepEqual(Buffer.from(rollback.files.database, 'base64'), originalDatabase);
});

test('invalid JSON, unsupported version, oversized file, corrupt SQLite and missing columns never stage or replace data', async t => {
  const context = await setup(t);
  await seed(context);
  await context.backup.exportDataBackup();
  const valid = JSON.parse(await files.readFile(context.state.filename, 'utf8'));
  const original = await files.readFile(path.join(context.directory, 'gitinsight.db'));
  const empty = new context.SQL.Database();
  const invalids = ['invalid', JSON.stringify({ ...valid, version: 99 }), JSON.stringify({ ...valid, config: [] }),
    JSON.stringify({ ...valid, config: { ...valid.config, feishuForm: { ...valid.config.feishuForm, reporterUserId: {} } } }),
    JSON.stringify({ ...valid, config: { ...valid.config, autoSync: { enabled: true, tasks: [null] } } }),
    JSON.stringify({ ...valid, config: { ...valid.config, reporterName: 'x'.repeat(1024 * 1024) } }),
    JSON.stringify({ ...valid, database: Buffer.from('SQLite format 3\0corrupt').toString('base64') }),
    JSON.stringify({ ...valid, database: Buffer.from(empty.export()).toString('base64') })];
  empty.close();
  const brokenColumns = new context.SQL.Database(Buffer.from(valid.database, 'base64'));
  brokenColumns.run('ALTER TABLE daily_reports RENAME COLUMN report TO missing_report');
  invalids.push(JSON.stringify({ ...valid, database: Buffer.from(brokenColumns.export()).toString('base64') }));
  brokenColumns.close();
  const brokenRoot = new context.SQL.Database(Buffer.from(valid.database, 'base64'));
  brokenRoot.run("PRAGMA writable_schema=ON; UPDATE sqlite_master SET rootpage=999999 WHERE name='daily_reports'");
  invalids.push(JSON.stringify({ ...valid, database: Buffer.from(brokenRoot.export()).toString('base64') }));
  brokenRoot.close();
  for (const invalid of invalids) {
    await files.writeFile(context.state.filename, invalid);
    await assert.rejects(context.backup.restoreDataBackup());
    assert.deepEqual(await files.readFile(path.join(context.directory, 'gitinsight.db')), original);
    assert.equal(fs.existsSync(path.join(context.directory, 'restore-pending.json')), false);
  }
  await files.truncate(context.state.filename, context.backup.MAX_BACKUP_BYTES + 1);
  await assert.rejects(context.backup.restoreDataBackup(), /大小|上限/);
  assert.equal(context.state.relaunches, 0);
});

test('restore failure after database replacement keeps pending and immutable originals for retry', async t => {
  const context = await setup(t);
  await seed(context);
  await context.backup.exportDataBackup();
  const exported = JSON.parse(await files.readFile(context.state.filename, 'utf8'));
  exported.config.reporterName = 'Imported reporter';
  exported.config.aiApiKey = 'imported-secret';
  exported.config.aiProfiles[0].apiKey = 'imported-secret';
  exported.config.feishuForm.cookie = 'imported-cookie';
  const importedDb = new context.SQL.Database(Buffer.from(exported.database, 'base64'));
  importedDb.run("UPDATE error_logs SET message = 'imported error'");
  exported.database = Buffer.from(importedDb.export()).toString('base64');
  importedDb.close();
  await files.writeFile(context.state.filename, JSON.stringify(exported));
  const original = await files.readFile(path.join(context.directory, 'gitinsight.db'));
  await context.backup.restoreDataBackup();
  const startup = await setup(t, context.directory);
  startup.state.failConfigWrite = true;
  await assert.rejects(startup.backup.applyPendingRestore(), /injected config/);
  assert.equal(fs.existsSync(path.join(context.directory, 'restore-pending.json')), true);
  const rollbackName = (await files.readdir(context.directory)).find(name => name.startsWith('restore-original-'));
  const rollbackBefore = await files.readFile(path.join(context.directory, rollbackName));
  assert.deepEqual(Buffer.from(JSON.parse(rollbackBefore).files.database, 'base64'), original);
  startup.state.failConfigWrite = false;
  await startup.backup.applyPendingRestore();
  assert.deepEqual(await files.readFile(path.join(context.directory, rollbackName)), rollbackBefore);
  assert.equal((await startup.config.loadConfig()).reporterName, 'Imported reporter');
  assert.equal((await startup.config.loadConfig()).aiApiKey, '');
  assert.equal((await startup.config.loadConfig()).feishuForm.cookie, '');
  const finalDb = await startup.database.getDatabase();
  assert.equal(finalDb.exec('SELECT message FROM error_logs')[0].values[0][0], 'imported error');
});

test('canceling selection or confirmation leaves files unchanged and does not restart', async t => {
  const context = await setup(t);
  await seed(context);
  context.state.cancel = true;
  assert.equal((await context.backup.exportDataBackup()).canceled, true);
  assert.equal((await context.backup.restoreDataBackup()).canceled, true);
  context.state.cancel = false;
  await context.backup.exportDataBackup();
  context.state.confirm = 1;
  assert.equal((await context.backup.restoreDataBackup()).canceled, true);
  assert.equal(context.state.relaunches, 0);
  assert.equal(fs.existsSync(path.join(context.directory, 'restore-pending.json')), false);
});

test('restore resolves an interrupted config save before snapshot and never replays it over imported data', async t => {
  const context = await setup(t);
  await seed(context);
  await context.backup.exportDataBackup();
  const exported = JSON.parse(await files.readFile(context.state.filename, 'utf8'));
  exported.config.reporterName = 'Imported reporter';
  await files.writeFile(context.state.filename, JSON.stringify(exported));
  await context.backup.restoreDataBackup();
  const configPath = path.join(context.directory, 'config.json');
  const previous = {
    config: await files.readFile(configPath, 'utf8'),
    secrets: await files.readFile(path.join(context.directory, 'secrets.json'), 'utf8'),
  };
  await files.writeFile(`${configPath}.transaction.json`, JSON.stringify(previous));
  await files.writeFile(configPath, 'partially-written config');
  const startup = await setup(t, context.directory);
  await startup.backup.applyPendingRestore();
  assert.equal((await startup.config.loadConfig()).reporterName, 'Imported reporter');
  assert.equal(fs.existsSync(`${configPath}.transaction.json`), false);
  const rollbackName = (await files.readdir(context.directory)).find(name => name.startsWith('restore-original-'));
  const rollback = JSON.parse(await files.readFile(path.join(context.directory, rollbackName), 'utf8'));
  assert.equal(Buffer.from(rollback.files.config, 'base64').toString(), previous.config);
  assert.equal(Buffer.from(rollback.files.secrets, 'base64').toString(), previous.secrets);
});

test('new databases do not initialize farm tables', async t => {
  const context = await setup(t);
  const db = await context.database.getDatabase();
  assert.deepEqual(db.exec("SELECT name FROM sqlite_master WHERE name LIKE 'jiazi_farm_%'"), []);
});
