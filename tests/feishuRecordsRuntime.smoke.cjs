const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { compileFunction } = require('node:vm');

if (!process.versions.electron) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.FEISHU_RUNTIME_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'gitinsight-feishu-runtime-'));
  try {
    const result = require('node:child_process').spawnSync(require('electron'), [__filename], { env, encoding: 'utf8', timeout: 40000 });
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exitCode = result.status ?? 1;
  } finally {
    fs.rmSync(env.FEISHU_RUNTIME_ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
} else {
  const { app, BrowserWindow, session } = require('electron');
  app.disableHardwareAcceleration();
  const ts = require('typescript');
  app.setPath('userData', process.env.FEISHU_RUNTIME_ROOT);
  app.setPath('sessionData', process.env.FEISHU_RUNTIME_ROOT);
  let html;
  class FixtureWindow extends BrowserWindow {
    async loadURL() { return super.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`); }
  }
  function loadModule(name, imports) {
    const source = fs.readFileSync(path.resolve(`electron/main/${name}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
    const exports = {};
    compileFunction(compiled.outputText, ['require', 'exports'])(name => {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    }, exports);
    return exports;
  }
  app.whenReady().then(async () => {
    const keepAlive = new BrowserWindow({ show: false });
    const auth = loadModule('feishuAuth', {
      electron: { BrowserWindow: FixtureWindow, session },
      '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
      './windows.js': {},
    });
    const posts = [];
    const dialogs = [];
    const form = loadModule('feishuForm', {
      electron: { dialog: { async showMessageBox(options) { dialogs.push(options); return { response: 0 }; } } },
      '../../src/shared/types.js': { DEFAULT_FEISHU_FORM_CONFIG: {} },
      './config.js': { normalizeWorkHours: value => value ?? 8 },
      './database.js': { async recordErrorLog() {}, async recordSyncLog() {} },
      './networkRequest.js': { async fetchWithTimeout(url) { posts.push(url); return new Response(JSON.stringify({ code: 0 })); } },
      './windows.js': { mainWindow: null },
      './feishuAuth.js': { ...auth, async resolveFeishuAuth() { return { endpoint: 'https://example.test/submit' }; } },
    });
    const config = { endpoint: 'https://example.test/submit', shareToken: 'shr-test', reporterUserId: 'user', reporterName: 'Tester', reporterAvatarUrl: '', projectOptionId: 'project', projectName: 'Project One', defaultWorkHours: 8, dateFieldId: 'date', userFieldId: 'user', questionId: 'table', projectFieldId: 'project', hoursFieldId: 'hours', contentFieldId: 'content' };
    const payload = { config, targetDate: '2026-10-16', projectName: 'Project One', workHours: 8 };
    const fixture = (label, date = '2026/10/15', hours = '8.0') => `<h1>我的提交记录</h1><article><div>日期<br>${date}</div><div><span>所属项目</span><span>Project One</span></div><div><span>${label}</span><span>${hours}</span></div><div>工作内容<br>完成测试</div></article>`;
    for (const label of ['暂无提交记录', '暂无记录', '暂无数据', '还没有提交记录']) {
      html = '<button id="records">查看提交记录</button><script>document.getElementById("records").onclick = () => { document.body.innerHTML = ' + JSON.stringify(`<h1>我的提交记录</h1><div>${label}</div>`) + '; };</script>';
      assert.deepEqual(await auth.checkFeishuDuplicate(payload), { available: true, matches: 0 });
      for (const triggerType of ['manual', 'scheduled']) {
        assert.equal((await form.syncFeishuDaily({ config, date: payload.targetDate, workHours: 8, report: 'work', reporterName: 'Tester', triggerType })).success, true);
      }
      assert.equal(dialogs.length, 0);
    }
    assert.equal(posts.length, 8);
    posts.length = 0;
    html = '<h1>我的提交记录</h1><div style="display:none">暂无提交记录</div><div>加载中</div>';
    assert.equal((await auth.checkFeishuDuplicate(payload)).available, false);
    html = '<h1>我的提交记录</h1><div>加载中</div><script>setTimeout(() => { document.body.innerHTML = ' + JSON.stringify(fixture('每日工作时长（h）', '2026/10/16')) + '; }, 600)</script>';
    assert.deepEqual(await auth.checkFeishuDuplicate(payload), { available: true, matches: 1 });
    for (const label of ['每日工作时长（h）', '每日工作时长 (h)', '工作时长']) {
      html = fixture(label);
      assert.deepEqual(await auth.checkFeishuDuplicate(payload), { available: true, matches: 0 });
      const result = await form.syncFeishuDaily({ config, date: payload.targetDate, workHours: 8, report: '今日工作内容：完成测试', reporterName: 'Tester' });
      assert.equal(result.success, true);
      assert.equal(dialogs.length, 0);
    }
    assert.equal(posts.length, 3);
    html = fixture('每日工作时长（h）', '2026/10/16');
    assert.deepEqual(await auth.checkFeishuDuplicate(payload), { available: true, matches: 1 });
    await assert.rejects(form.syncFeishuDaily({ config, date: payload.targetDate, workHours: 8, report: 'work', reporterName: 'Tester' }), /已取消发布/);
    assert.equal(dialogs.length, 1);
    assert.equal(posts.length, 3);
    html = fixture('每日工作时长（h）', '2026/10/16', '6.5');
    assert.deepEqual(await auth.checkFeishuDuplicate(payload), { available: true, matches: 0 });
    console.log('FEISHU_RUNTIME PASS: real hidden Electron DOM; labelled record navigation; 4 empty states publish manually and on schedule without dialogs; hidden/loading states stay unavailable; delayed duplicate, 3 hours labels, duplicate cancellation and different hours checked. Remote POST mocked.');
    keepAlive.destroy();
    app.quit();
  }).catch(error => { console.error(error); app.exit(1); });
}
