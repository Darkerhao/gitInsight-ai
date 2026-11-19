import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assistantHarness, deferred, tick } from './helpers/assistantHarness.mjs';

test('runtime events preserve unsaved task fields, global enabled, new and deleted tasks', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const editing = ctx.assistant.config.autoSync;
  editing.enabled = false;
  Object.assign(editing.tasks[0], { name: 'Unsaved', time: '09:25', enabled: false, repoPaths: ['edited'], projectName: 'Edited project' });
  editing.tasks.push({ ...ctx.shared.DEFAULT_AUTO_SYNC_TASK_CONFIG, id: 'new', name: 'New unsaved' });
  const state = ctx.runtime();
  Object.assign(state.tasks[0], { lastStatus: 'success', lastRunAt: 'latest', lastMessage: 'done', lastSuccessKey: 'latest-key' });
  state.tasks.push({ ...ctx.shared.DEFAULT_AUTO_SYNC_TASK_CONFIG, id: 'deleted', name: 'Deleted task' });
  ctx.emitAutoSync(state);
  assert.equal(editing.enabled, false);
  assert.deepEqual(editing.tasks.map((task) => task.id), ['saved', 'new']);
  assert.equal(editing.tasks[0].name, 'Unsaved');
  assert.equal(editing.tasks[0].time, '09:25');
  assert.equal(editing.tasks[0].enabled, false);
  assert.deepEqual(editing.tasks[0].repoPaths, ['edited']);
  assert.equal(editing.tasks[0].projectName, 'Edited project');
  assert.equal(editing.tasks[0].lastRunAt, 'latest');
  assert.equal(editing.tasks[0].lastSuccessKey, 'latest-key');
  assert.equal(ctx.assistant.getAutoSyncTaskState('saved').lastMessage, 'done');
  assert.equal(ctx.assistant.isConfigDirty.value, true);
  editing.tasks = editing.tasks.filter((task) => task.id !== 'saved');
  ctx.emitAutoSync(state);
  assert.deepEqual(editing.tasks.map((task) => task.id), ['new']);
  ctx.assistant.dispose();
});

test('runtime updates for a newly saved task do not mark edits dirty', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  ctx.assistant.config.autoSync.tasks.push({ ...ctx.shared.DEFAULT_AUTO_SYNC_TASK_CONFIG, id: 'new', name: 'New' });
  await ctx.assistant.persistConfig();
  const state = ctx.runtime();
  state.tasks.push({ ...ctx.shared.DEFAULT_AUTO_SYNC_TASK_CONFIG, id: 'new', lastStatus: 'running', lastRunKey: 'new-run' });
  ctx.emitAutoSync(state);
  assert.equal(ctx.assistant.config.autoSync.tasks[1].lastRunKey, 'new-run');
  assert.equal(ctx.assistant.config.autoSync.tasks[1].name, 'New');
  assert.equal(ctx.assistant.isConfigDirty.value, false);
  ctx.assistant.dispose();
});

test('save completion preserves later task edits and their unsaved indication', async () => {
  const pending = deferred();
  let payload;
  const ctx = assistantHarness();
  await ctx.assistant.init();
  ctx.api.saveConfig = (value) => { payload = structuredClone(value); return pending.promise; };
  ctx.assistant.config.autoSync.tasks[0].name = 'Saved revision';
  const saving = ctx.assistant.saveSettings();
  await tick();
  ctx.assistant.config.autoSync.tasks[0].name = 'Later unsaved revision';
  ctx.assistant.config.reporterName = 'Later reporter';
  pending.resolve(payload);
  await saving;
  assert.equal(ctx.assistant.config.autoSync.tasks[0].name, 'Later unsaved revision');
  assert.equal(ctx.assistant.isConfigDirty.value, true);
  ctx.assistant.dispose();
});

test('edits made during validation stay unsaved until they pass validation', async () => {
  const pending = deferred();
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const task = ctx.assistant.config.autoSync.tasks[0];
  task.name = 'Validated revision';
  ctx.api.validateAutoSync = (payload) => {
    assert.equal(payload.autoSync.tasks[0].name, 'Validated revision');
    return pending.promise;
  };
  const saving = ctx.assistant.saveSettings();
  task.name = 'Edited during validation';
  pending.resolve({ valid: true });
  await saving;
  assert.equal(ctx.saves.length, 0);
  assert.equal(ctx.assistant.isConfigDirty.value, true);

  ctx.api.validateAutoSync = async (payload) => {
    assert.equal(payload.autoSync.tasks[0].name, 'Edited during validation');
    return { valid: true };
  };
  await ctx.assistant.saveSettings();
  assert.equal(ctx.saves[0].autoSync.tasks[0].name, 'Edited during validation');
  assert.equal(ctx.assistant.isConfigDirty.value, false);
  ctx.assistant.dispose();
});

test('AI profile and option edits do not write configuration on their own', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const { assistant } = ctx;
  assistant.config.aiBaseUrlOptions = ['https://example.test/v1'];
  assistant.config.aiModelOptions = ['model-to-remove'];
  assistant.activeAiProfile.value.baseUrl = 'https://active.example.test/v1';
  assistant.activeAiProfile.value.model = 'active-model';
  assistant.rememberAiModelOption('model-to-remove');
  assistant.removeAiOption('baseUrl', 'https://example.test/v1');
  assistant.removeAiOption('model', 'model-to-remove');
  assert.equal(assistant.activeAiProfile.value.baseUrl, 'https://active.example.test/v1');
  assert.equal(assistant.activeAiProfile.value.model, 'active-model');
  assert.ok(assistant.isConfigDirty.value);
  assistant.createAiProfile();
  await assistant.removeAiProfile(assistant.config.activeAiProfileId);
  assert.equal(assistant.config.aiProfiles.length, 1);
  assert.equal(ctx.saves.length, 0);
  assert.equal(assistant.isConfigDirty.value, true);
  await assistant.saveSettings();
  assert.equal(ctx.saves.length, 1);
  assert.ok(!ctx.saves[0].aiBaseUrlOptions.includes('https://example.test/v1'));
  assert.ok(!ctx.saves[0].aiModelOptions.includes('model-to-remove'));
  assert.equal(assistant.isConfigDirty.value, false);
  assistant.dispose();
});

test('AI options used by another profile are not deleted from the suggestions', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const { assistant } = ctx;
  const { baseUrl, model } = assistant.activeAiProfile.value;
  assistant.rememberAiBaseUrlOption(baseUrl);
  assistant.rememberAiModelOption(model);
  assistant.rememberAiBaseUrlOption('https://unused.example.test/v1');
  assistant.rememberAiModelOption('unused-model');
  const otherProfileId = assistant.activeAiProfile.value.id;
  assistant.createAiProfile();
  assistant.activeAiProfile.value.baseUrl = 'https://other.example.test/v1';
  assistant.activeAiProfile.value.model = 'other-model';
  await assistant.saveSettings();

  assistant.removeAiOption('baseUrl', baseUrl);
  assistant.removeAiOption('model', model);
  assert.equal(assistant.aiBaseUrlOptions.value.includes(baseUrl), true);
  assert.equal(assistant.aiModelOptions.value.includes(model), true);
  assert.ok(ctx.messages.includes('请先将使用此选项的 AI 配置改为其他值'));
  assert.equal(assistant.isConfigDirty.value, false);

  assistant.removeAiOption('baseUrl', 'https://unused.example.test/v1');
  assistant.removeAiOption('model', 'unused-model');

  assert.ok(!assistant.aiBaseUrlOptions.value.includes('https://unused.example.test/v1'));
  assert.ok(!assistant.aiModelOptions.value.includes('unused-model'));
  assert.equal(assistant.config.aiProfiles.find(profile => profile.id === otherProfileId).model, model);
  assert.equal(assistant.isConfigDirty.value, true);
  assistant.dispose();
});

test('validation and save failures preserve all configuration edits and can retry', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const { assistant } = ctx;
  assistant.activeAiProfile.value.name = 'Unsaved profile';
  ctx.api.validateAutoSync = async () => { throw new Error('validation unavailable'); };
  await assistant.saveSettings();
  assert.ok(ctx.messages.includes('validation unavailable'));
  assert.equal(assistant.isConfigDirty.value, true);
  ctx.api.validateAutoSync = async () => ({ valid: true });
  const save = ctx.api.saveConfig;
  ctx.api.saveConfig = async () => { throw new Error('disk full'); };
  await assistant.saveSettings();
  assert.ok(ctx.messages.includes('disk full'));
  assert.equal(assistant.activeAiProfile.value.name, 'Unsaved profile');
  assert.equal(assistant.isConfigDirty.value, true);
  ctx.api.saveConfig = save;
  await assistant.saveSettings();
  assert.equal(ctx.saves.length, 1);
  assert.equal(assistant.isConfigDirty.value, false);
  assistant.dispose();
});
