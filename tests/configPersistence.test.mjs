import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as files from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);

async function configContext(t, overrides = {}) {
  const directory = await files.mkdtemp(path.join(tmpdir(), 'gitinsight-config-'));
  t.after(() => files.rm(directory, { recursive: true, force: true }));
  const cache = new Map();
  const configPath = path.join(directory, 'config.json');
  const secretsPath = path.join(directory, 'secrets.json');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(value),
    decryptString: value => value.toString(),
    ...overrides.safeStorage,
  };
  const mocks = {
    electron: { safeStorage },
    'node:fs/promises': { ...files, ...overrides.files },
  };
  async function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    if (filename.endsWith('/paths.ts')) return {
      ensureConfigDir: async () => {}, getConfigPath: () => configPath, getSecretsPath: () => secretsPath,
    };
    const source = await files.readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
    const imports = {};
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      const name = match[1];
      imports[name] = mocks[name] ?? (name.startsWith('.')
        ? await load(path.posix.normalize(path.posix.join(path.posix.dirname(filename), name.replace(/\.js$/, '.ts'))))
        : require(name));
    }
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } });
    const exports = {};
    compileFunction(outputText, ['require', 'exports'])(name => imports[name], exports);
    cache.set(filename, exports);
    return exports;
  }
  return {
    api: await load('electron/main/config.ts'), directory, configPath, secretsPath, safeStorage,
    reload: async () => { cache.clear(); return load('electron/main/config.ts'); },
  };
}

test('first launch returns defaults, but invalid JSON and IO failures remain visible', async t => {
  const context = await configContext(t);
  assert.equal((await context.api.loadConfig()).reporterName, '');
  await files.writeFile(context.configPath, '{broken');
  await assert.rejects(context.api.loadConfig(), /JSON|配置/);
  assert.equal(await files.readFile(context.configPath, 'utf8'), '{broken');
  await files.writeFile(context.configPath, 'null');
  await assert.rejects(context.api.loadConfig(), /配置/);
  const denied = await configContext(t, { files: { async readFile() { throw Object.assign(new Error('access denied'), { code: 'EACCES' }); } } });
  await assert.rejects(denied.api.loadConfig(), /access denied/);
});

test('existing secrets must decrypt successfully and require available encryption', async t => {
  const context = await configContext(t);
  await files.writeFile(context.secretsPath, '{broken');
  await assert.rejects(context.api.loadConfig());
  await files.writeFile(context.secretsPath, JSON.stringify({ payload: Buffer.from('{}').toString('base64') }));
  context.safeStorage.isEncryptionAvailable = () => false;
  await assert.rejects(context.api.loadConfig(), /密钥/);
  context.safeStorage.isEncryptionAvailable = () => true;
  context.safeStorage.decryptString = () => { throw new Error('decrypt failed'); };
  await assert.rejects(context.api.loadConfig(), /decrypt failed/);
});

test('partial file write preserves both previous config and secrets; queue can save again', async t => {
  let fail = false;
  const context = await configContext(t, { files: { async writeFile(filename, contents, options) {
    if (fail && path.basename(filename).startsWith('config.json.') && !filename.includes('transaction')) {
      fail = false;
      await files.writeFile(filename, 'partial');
      throw new Error('disk full');
    }
    return files.writeFile(filename, contents, options);
  } } });
  const original = context.api.normalizeConfig({ reporterName: 'old', aiApiKey: 'old-secret' });
  await context.api.saveConfig(original);
  const oldConfig = await files.readFile(context.configPath, 'utf8');
  const oldSecrets = await files.readFile(context.secretsPath, 'utf8');
  fail = true;
  await assert.rejects(context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'new', aiApiKey: 'new-secret' })), /disk full/);
  assert.equal(await files.readFile(context.configPath, 'utf8'), oldConfig);
  assert.equal(await files.readFile(context.secretsPath, 'utf8'), oldSecrets);
  assert.equal((await context.api.loadConfig()).aiApiKey, 'old-secret');
  assert.equal((await context.api.saveConfig(original)).reporterName, 'old');
  assert.deepEqual((await files.readdir(context.directory)).sort(), ['config.json', 'secrets.json']);
});

test('queued reads wait for complete config and secret writes; read-mutate-write updates compose', async t => {
  let pause;
  let release;
  const blocked = new Promise(resolve => { pause = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let block = false;
  const context = await configContext(t, { files: { async rename(source, target) {
    await files.rename(source, target);
    if (block && path.basename(target) === 'secrets.json') { block = false; pause(); await gate; }
  } } });
  await context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'old', aiApiKey: 'old-secret' }));
  block = true;
  const save = context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'new', aiApiKey: 'new-secret' }));
  await blocked;
  let readCompleted = false;
  const read = context.api.loadConfig().then(config => { readCompleted = true; return config; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(readCompleted, false);
  release();
  await save;
  assert.equal((await read).reporterName, 'new');
  assert.equal((await read).aiApiKey, 'new-secret');
  await Promise.all([
    context.api.updateConfig(config => ({ ...config, reporterName: 'Alice' })),
    context.api.updateConfig(config => ({ ...config, gitAuthorEmail: `${config.reporterName}@example.test` })),
  ]);
  assert.equal((await context.api.loadConfig()).gitAuthorEmail, 'Alice@example.test');
});

test('unavailable encryption rejects secret saves without changing existing files', async t => {
  const context = await configContext(t);
  context.safeStorage.isEncryptionAvailable = () => false;
  await assert.rejects(context.api.saveConfig(context.api.normalizeConfig({ aiApiKey: 'secret' })), /密钥/);
  assert.deepEqual(await files.readdir(context.directory), []);
  await context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'no secrets' }));
  assert.equal((await context.api.loadConfig()).reporterName, 'no secrets');
});

test('interrupted rollback blocks mixed reads and recovers the previous pair after restart', async t => {
  let fail = false;
  const context = await configContext(t, { files: { async rename(source, target) {
    if (fail && path.basename(target) === 'config.json') throw new Error('disk unavailable');
    return files.rename(source, target);
  } } });
  await context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'old', aiApiKey: 'old-secret' }));
  const oldConfig = await files.readFile(context.configPath, 'utf8');
  const oldSecrets = await files.readFile(context.secretsPath, 'utf8');
  fail = true;
  await assert.rejects(context.api.saveConfig(context.api.normalizeConfig({ reporterName: 'new', aiApiKey: 'new-secret' })), /旧配置尚未恢复/);
  await assert.rejects(context.api.loadConfig(), /disk unavailable/);
  await files.access(`${context.configPath}.transaction.json`);
  fail = false;
  const restarted = await context.reload();
  const recovered = await restarted.loadConfig();
  assert.equal(recovered.reporterName, 'old');
  assert.equal(recovered.aiApiKey, 'old-secret');
  assert.equal(await files.readFile(context.configPath, 'utf8'), oldConfig);
  assert.equal(await files.readFile(context.secretsPath, 'utf8'), oldSecrets);
  assert.deepEqual((await files.readdir(context.directory)).sort(), ['config.json', 'secrets.json']);
});

test('failed first save removes new files and an invalid recovery journal cannot overwrite files', async t => {
  let fail = true;
  const context = await configContext(t, { files: { async rename(source, target) {
    if (fail && path.basename(target) === 'config.json') { fail = false; throw new Error('replace failed'); }
    return files.rename(source, target);
  } } });
  await assert.rejects(context.api.saveConfig(context.api.normalizeConfig({ aiApiKey: 'secret' })), /replace failed/);
  assert.deepEqual(await files.readdir(context.directory), []);
  await files.writeFile(context.configPath, '{broken');
  await files.writeFile(`${context.configPath}.transaction.json`, '{}');
  await assert.rejects(context.api.loadConfig(), /恢复文件格式无效/);
  assert.equal(await files.readFile(context.configPath, 'utf8'), '{broken');
});
