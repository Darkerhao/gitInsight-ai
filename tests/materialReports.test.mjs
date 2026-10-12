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
import * as vue from 'vue';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const material = (role = 'projectManager', date = '2026-10-12') => ({ role, date,
  sections: [{ key: 'progress', label: '今日推进事项', content: `${role} ${date} 完成评审` }], extraNotes: '风险已同步' });
const reportPayload = (input, id) => ({ id, date: input.date, reporterName: '测试', repoNames: [], repoPaths: [],
  report: '已完成评审', status: 'draft', commitsCount: 0, filesCount: 0,
  rawInput: { gitLogs: '', files: '', diff: '', materialRole: input.role, material: input } });

async function harness(t, directory) {
  directory ??= await files.mkdtemp(path.join(tmpdir(), 'gitinsight-material-'));
  t.after(() => files.rm(directory, { recursive: true, force: true }));
  const SQL = await initSqlJs();
  const state = { filename: path.join(directory, 'export.gitinsight-backup'), requests: [], failNetwork: false };
  const electron = { app: { getPath: () => directory, getVersion: () => 'test', relaunch() {}, exit() {} },
    safeStorage: { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() },
    dialog: { showSaveDialog: async () => ({ filePath: state.filename }),
      showOpenDialog: async () => ({ filePaths: [state.filename] }), showMessageBox: async () => ({ response: 0 }) } };
  const cache = new Map();
  function load(filename) {
    filename = path.resolve(root, filename);
    if (cache.has(filename)) return cache.get(filename);
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } });
    const exports = {};
    cache.set(filename, exports);
    compileFunction(outputText, ['require', 'exports', 'fetch'])(specifier => {
      if (specifier === 'electron') return electron;
      if (specifier === 'sql.js') return async () => SQL;
      if (specifier.includes('gitCollect') || specifier === 'simple-git') throw new Error('素材生成禁止读取 Git');
      if (specifier === 'vue') return vue;
      if (specifier.startsWith('@shared/')) return load(`src/shared/${specifier.slice(8).replace(/\.js$/, '')}.ts`);
      if (specifier.startsWith('.')) return load(path.resolve(path.dirname(filename), specifier.replace(/\.js$/, '') + '.ts'));
      return require(specifier);
    }, exports, async (url, init) => {
      state.requests.push({ url, body: JSON.parse(init.body) });
      if (state.failNetwork) throw new Error('AI unavailable');
      return new Response(JSON.stringify({ choices: [{ message: { content: '已完成评审，无其他补写。' } }] }), { headers: { 'content-type': 'application/json' } });
    });
    return exports;
  }
  const database = load('electron/main/database.ts');
  t.after(() => database.sqlDatabase?.close());
  return { directory, SQL, state, load, database };
}

test('旧 role_materials 可读取，两角色/两日期素材隔离且持久化', async t => {
  const h = await harness(t);
  const old = new h.SQL.Database();
  old.run("CREATE TABLE role_materials (role TEXT NOT NULL, date TEXT NOT NULL, sections_json TEXT NOT NULL, extra_notes TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (role,date))");
  old.run('INSERT INTO role_materials VALUES (?,?,?,?,?)', ['projectManager', '2026-10-11', JSON.stringify(material().sections), '旧版素材', '2026-10-11']);
  await files.writeFile(path.join(h.directory, 'gitinsight.db'), old.export()); old.close();
  assert.equal((await h.database.loadRoleMaterial('projectManager', '2026-10-11')).extraNotes, '旧版素材');
  for (const role of ['projectManager', 'productManager']) for (const date of ['2026-10-12', '2026-10-13']) {
    await h.database.saveRoleMaterial(material(role, date));
  }
  const disk = new h.SQL.Database(await files.readFile(path.join(h.directory, 'gitinsight.db')));
  assert.equal(disk.exec('SELECT COUNT(*) FROM role_materials')[0].values[0][0], 5); disk.close();
  assert.match((await h.database.loadRoleMaterial('productManager', '2026-10-13')).sections[0].content, /productManager 2026-10-13/);
});

test('素材生成使用选择的 AI 配置，不读取 Git，失败向编辑器保留原文', async t => {
  const h = await harness(t);
  const config = h.load('electron/main/config.ts');
  await config.saveConfig(config.normalizeConfig({ aiProfiles: [{ id: 'material', name: '素材', baseUrl: 'https://material.invalid/v1', apiKey: 'test', model: 'material-model', enabled: true }], activeAiProfileId: 'material' }));
  const generate = h.load('electron/main/materialReport.ts').generateReportFromMaterial;
  const result = await generate({ ...material(), reporterName: '测试' });
  assert.equal(result.report, '已完成评审，无其他补写。');
  assert.equal(h.state.requests[0].url, 'https://material.invalid/v1/chat/completions');
  assert.equal(h.state.requests[0].body.model, 'material-model');
  assert.match(h.state.requests[0].body.messages[1].content, /风险已同步/);
  h.state.failNetwork = true;
  await assert.rejects(generate({ ...material(), reporterName: '测试' }), /AI unavailable/);
});

test('未启用 AI 时保留旧版按分区排版能力，空素材不能生成', async t => {
  const h = await harness(t);
  const generate = h.load('electron/main/materialReport.ts').generateReportFromMaterial;
  const result = await generate({ ...material('productManager'), reporterName: '测试' });
  assert.match(result.report, /产品经理日报/);
  assert.match(result.report, /风险已同步/);
  assert.equal(h.state.requests.length, 0);
  await assert.rejects(generate({ ...material(), sections: [], extraNotes: '', reporterName: '测试' }), /至少填写/);
  await assert.rejects(generate({ ...material(), reporterName: '  ' }), /请先填写汇报人/);
});

test('素材日报与历史日报共用保存，拒绝覆盖其他角色、日期或研发记录', async t => {
  const h = await harness(t);
  const pm = await h.database.saveDailyReport(reportPayload(material()));
  assert.equal(pm.materialRole, 'projectManager');
  assert.deepEqual(pm.material, material());
  assert.deepEqual(pm.rawInput, reportPayload(material()).rawInput);
  assert.equal((await h.database.loadMaterialReport('projectManager', '2026-10-12')).id, pm.id);
  for (const input of [material('productManager'), material('projectManager', '2026-10-13')]) {
    await assert.rejects(h.database.saveDailyReport(reportPayload(input, pm.id)), /角色|日期|不匹配/);
  }
  const developer = { ...reportPayload(material()), rawInput: { gitLogs: 'commit', files: '', diff: '' } };
  const dev = await h.database.saveDailyReport(developer);
  await assert.rejects(h.database.saveDailyReport(reportPayload(material(), dev.id)), /角色|不匹配/);
  assert.equal((await h.database.getDailyReportById(dev.id)).materialRole, undefined);
  assert.equal((await h.database.listDailyReports()).length, 2);
});

test('旧 v1 备份缺少素材表仍可恢复，有素材表的新备份完整往返，坏表被拒绝', async t => {
  const h = await harness(t);
  const backup = h.load('electron/main/backup.ts');
  await h.database.saveRoleMaterial(material());
  await h.database.saveDailyReport(reportPayload(material()));
  await backup.exportDataBackup();
  const saved = JSON.parse(await files.readFile(h.state.filename, 'utf8'));
  const roundtrip = new h.SQL.Database(Buffer.from(saved.database, 'base64'));
  assert.equal(roundtrip.exec('SELECT extra_notes FROM role_materials')[0].values[0][0], '风险已同步');
  roundtrip.run('ALTER TABLE role_materials RENAME COLUMN sections_json TO broken');
  await files.writeFile(h.state.filename, JSON.stringify({ ...saved, database: Buffer.from(roundtrip.export()).toString('base64') }));
  await assert.rejects(backup.restoreDataBackup(), /role_materials/);
  roundtrip.run('DROP TABLE role_materials');
  await files.writeFile(h.state.filename, JSON.stringify({ ...saved, database: Buffer.from(roundtrip.export()).toString('base64') }));
  roundtrip.close();
  await backup.restoreDataBackup();
  const startup = await harness(t, h.directory);
  await startup.load('electron/main/backup.ts').applyPendingRestore();
  assert.equal(await startup.database.loadRoleMaterial('projectManager', '2026-10-12'), null);
  assert.equal((await startup.database.listDailyReports())[0].materialRole, 'projectManager');
  await files.writeFile(h.state.filename, JSON.stringify(saved));
  await startup.load('electron/main/backup.ts').restoreDataBackup();
  const restored = await harness(t, h.directory);
  await restored.load('electron/main/backup.ts').applyPendingRestore();
  assert.deepEqual((await restored.database.loadRoleMaterial('projectManager', '2026-10-12')).sections, material().sections);
});

test('成功同步日志恢复当前已保存版本的发布标记，后续编辑使标记失效', async t => {
  const h = await harness(t);
  const input = material();
  const report = await h.database.saveDailyReport(reportPayload(input));
  assert.equal(report.published, false);
  await h.database.recordSyncLog({ reportId: report.id, date: input.date, triggerType: 'manual', status: 'success', message: '已提交' });
  assert.equal((await h.database.getDailyReportById(report.id)).published, true);
  assert.equal((await h.database.loadMaterialReport(input.role, input.date)).published, true);
  assert.equal((await h.database.listDailyReports())[0].published, true);
  const history = await h.database.queryHistoryLogs({ type: '日报生成' });
  assert.equal(history.records[0].reportRecord.published, true);
  await new Promise(resolve => setTimeout(resolve, 5));
  await h.database.saveDailyReport({ ...reportPayload(input, report.id), report: '发布后的新编辑' });
  assert.equal((await h.database.loadMaterialReport(input.role, input.date)).published, false);
});

test('编辑器切换隔离上下文，生成失败保留手改，保存失败禁止发布', async t => {
  const h = await harness(t);
  const { createMaterialReports } = h.load('src/renderer/src/composables/useMaterialReports.ts');
  const saved = new Map(); const reports = new Map(); const published = [];
  let failSave = false; let resolveGeneration;
  const api = {
    loadRoleMaterial: async (role, date) => saved.get(`${role}:${date}`) ?? null,
    loadMaterialReport: async (role, date) => reports.get(`${role}:${date}`) ?? null,
    getDailyReport: async id => [...reports.values()].find(item => item.id === id) ?? null,
    saveRoleMaterial: async value => { saved.set(`${value.role}:${value.date}`, value); return value; },
    generateReportFromMaterial: async () => new Promise(resolve => { resolveGeneration = resolve; }),
    saveDailyReport: async value => { if (failSave) throw new Error('保存日报失败'); const record = { ...value, id: value.id ?? reports.size + 1, materialRole: value.rawInput.materialRole, material: value.rawInput.material, published: false }; reports.set(`${record.materialRole}:${record.date}`, record); return record; },
    syncFeishuDaily: async value => { published.push(value); [...reports.values()].find(item => item.id === value.reportId).published = true; return { success: true }; },
  };
  const editor = createMaterialReports({ api, config: { reporterName: '测试', feishuForm: { projectOptionId: 'p', projectName: '项目', defaultWorkHours: 8 } },
    persistConfig: async () => {}, confirmDiscard: async () => false }, '2026-10-12');
  await editor.load('projectManager', '2026-10-12');
  editor.draft.value.sections[0].content = '完成评审';
  editor.draft.value.report = '手改内容';
  assert.equal(await editor.load('productManager', '2026-10-13'), false);
  const generation = editor.generate();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await editor.load('productManager', '2026-10-13'), false);
  resolveGeneration({ report: '生成内容', role: 'projectManager', date: '2026-10-12', generatedAt: 'now' });
  await generation;
  editor.draft.value.report = '最新手改内容';
  failSave = true;
  assert.equal(await editor.publish(), false);
  assert.equal(published.length, 0);
  assert.equal(editor.draft.value.report, '最新手改内容');
  failSave = false;
  assert.equal(await editor.publish(), true);
  assert.equal(published[0].report, '最新手改内容');
  assert.equal(published[0].reportId, editor.draft.value.reportId);
  assert.equal(await editor.load('productManager', '2026-10-13'), true);
  assert.equal(editor.draft.value.reportId, undefined);
  assert.equal(editor.draft.value.report, '');
  assert.equal(editor.draft.value.sections.some(item => item.content), false);
  await editor.load('projectManager', '2026-10-12');
  assert.equal(editor.draft.value.report, '最新手改内容');
  assert.equal(editor.published.value, true);
  await editor.saveReport();
  assert.equal(reports.get('projectManager:2026-10-12').published, true, '重复保存未修改的正文不清除发布标记');
  api.generateReportFromMaterial = async () => { throw new Error('生成失败'); };
  assert.equal(await editor.generate(), false);
  assert.equal(editor.draft.value.report, '最新手改内容');
  editor.draft.value.report = '发布后新的编辑';
  assert.equal(editor.published.value, false);
  await editor.saveReport();
  await editor.load('projectManager', '2026-10-12');
  assert.equal(editor.published.value, false);
});

test('素材生成、日报保存和发布共用非空汇报人校验', async t => {
  const h = await harness(t);
  const { createMaterialReports } = h.load('src/renderer/src/composables/useMaterialReports.ts');
  const calls = [];
  const editor = createMaterialReports({ config: { reporterName: '   ', feishuForm: {} },
    api: Object.fromEntries(['saveRoleMaterial', 'generateReportFromMaterial', 'saveDailyReport', 'syncFeishuDaily'].map(name => [name, async () => { calls.push(name); return {}; }])),
    persistConfig: async () => {}, confirmDiscard: async () => true }, '2026-10-12');
  editor.draft.value.sections[0].content = '完成评审';
  editor.draft.value.report = '已编辑的正文';
  assert.equal(await editor.generate(), false);
  assert.match(editor.error.value, /请先填写汇报人/);
  assert.equal(await editor.saveReport(), false);
  assert.match(editor.error.value, /请先填写汇报人/);
  assert.equal(await editor.publish(), false);
  assert.match(editor.error.value, /请先填写汇报人/);
  assert.equal(editor.draft.value.report, '已编辑的正文');
  assert.deepEqual(calls, []);
});
