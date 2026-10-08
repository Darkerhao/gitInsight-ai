import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assistantHarness, deferred, tick } from './helpers/assistantHarness.mjs';

for (const mode of ['hanging', 'failed']) {
  test(`local initialization completes with ${mode} Feishu metadata without writing config`, async () => {
    const pending = deferred();
    let fields = 0;
    let projects = 0;
    const read = () => mode === 'hanging' ? pending.promise : Promise.reject(new Error('offline'));
    const ctx = assistantHarness({
      listFeishuFields: () => { fields++; return read(); },
      listFeishuProjects: () => { projects++; return read(); },
    });
    let ready = false;
    const initializing = ctx.assistant.init().then(() => { ready = true; });
    await tick();
    assert.equal(ready, true, 'local readiness must not await Feishu');
    assert.equal(ctx.assistant.config.reporterName, 'Tester');
    assert.equal(ctx.assistant.config.autoSync.tasks[0].id, 'saved');
    assert.equal(ctx.assistant.repos.value[0].name, 'Project A');
    assert.equal(ctx.assistant.dailyReports.value[0].id, 1);
    assert.equal(fields, 1);
    assert.equal(projects, 1);
    assert.equal(ctx.saves.length, 0);
    pending.resolve([]);
    await initializing;
    ctx.assistant.dispose();
  });
}

test('background metadata does not rename selected project or consume unsaved edits', async () => {
  const fields = deferred();
  const projects = deferred();
  const ctx = assistantHarness({ listFeishuFields: () => fields.promise, listFeishuProjects: () => projects.promise });
  const initializing = ctx.assistant.init();
  await tick();
  ctx.assistant.config.reporterName = 'Editing reporter';
  projects.resolve([{ id: 'a', name: 'Remote name' }]);
  fields.resolve([{ id: 'project', name: 'Project', type: 'select' }]);
  await initializing;
  await tick();
  assert.equal(ctx.assistant.config.feishuForm.projectName, 'Saved name');
  assert.equal(ctx.assistant.projectOptions.value[0].name, 'Remote name');
  assert.equal(ctx.assistant.isConfigDirty.value, true);
  assert.equal(ctx.saves.length, 0);
  ctx.assistant.dispose();
});

test('metadata IPC uses plain config snapshots for both background and explicit refresh', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  await tick();
  assert.equal(ctx.assistant.projectOptions.value[0]?.name, 'Remote name');
  await ctx.assistant.loadFeishuProjects();
  assert.equal(ctx.assistant.config.feishuForm.projectName, 'Remote name');
  assert.equal(ctx.saves.length, 1);
  assert.equal(ctx.messages.some((message) => /clone/i.test(message)), false);
  ctx.assistant.dispose();
});

test('late metadata for the previous form does not replace new form options or edits', async () => {
  const old = deferred();
  const ctx = assistantHarness({
    listFeishuFields: ({ config }) => config.shareToken === 'form-a' ? old.promise : Promise.resolve([{ id: 'new-field' }]),
    listFeishuProjects: ({ config }) => config.shareToken === 'form-a' ? old.promise : Promise.resolve([{ id: 'new-project', name: 'New remote' }]),
  });
  const initializing = ctx.assistant.init();
  await tick();
  ctx.assistant.config.feishuForm.shareToken = 'form-b';
  ctx.assistant.config.feishuForm.projectOptionId = 'new-project';
  ctx.assistant.config.feishuForm.projectName = 'Editing name';
  await Promise.all([ctx.assistant.loadFeishuFields(), ctx.assistant.loadFeishuProjects()]);
  old.resolve([{ id: 'old-option', name: 'Old remote' }]);
  await initializing;
  await tick();
  assert.equal(ctx.assistant.projectOptions.value[0].id, 'new-project');
  assert.equal(ctx.assistant.feishuFieldOptions.value[0].id, 'new-field');
  assert.equal(ctx.assistant.config.feishuForm.projectName, 'New remote');
  assert.equal(ctx.saves.length, 2, 'only explicit refreshes may persist config');
  ctx.assistant.dispose();
});

test('configuration read failures prevent data loading and auth-triggered writes, then allow retry', async () => {
  const ctx = assistantHarness();
  ctx.api.loadConfig = async () => { throw new Error('Configuration damaged'); };
  await assert.rejects(ctx.assistant.init(), /Configuration damaged/);
  ctx.emitAuth({ endpoint: 'https://example.test', shareToken: 'new', cookie: 'session', csrfToken: 'csrf' });
  await tick();
  assert.equal(ctx.saves.length, 0);
  assert.equal(ctx.assistant.repos.value.length, 0);
  ctx.api.loadConfig = async () => structuredClone(ctx.config);
  await ctx.assistant.init();
  assert.equal(ctx.assistant.repos.value.length, 1);
  ctx.assistant.dispose();
});
