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
