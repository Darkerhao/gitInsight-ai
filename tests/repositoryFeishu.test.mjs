import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextTick, effectScope } from 'vue';
import { assistantHarness } from './helpers/assistantHarness.mjs';

const repoA = { path: '/workspace/a', name: 'Project A' };
const repoB = { path: '/workspace/b', name: 'Project B' };
const binding = (id = 'b', name = '项目 B') => ({ id, name, shareToken: 'form-a', projectFieldId: 'project' });

test('repository association persists through reload and refresh, and removal clears it', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  await ctx.assistant.saveRepoSettings([{ path: repoA.path, displayName: '新名称', project: binding() }]);
  assert.equal(ctx.saves.at(-1).repoFeishuProjects[repoA.path].id, 'b');
  await ctx.assistant.refreshRepos();
  assert.equal(ctx.assistant.getRepoFeishuProject(repoA.path).name, '项目 B');
  const reload = assistantHarness({ loadConfig: async () => ctx.saves.at(-1) });
  await reload.assistant.init();
  assert.equal(reload.assistant.createProjectReportDraft(repoA).projectOptionId, 'b');
  await ctx.assistant.removeRepo(repoA.path);
  assert.deepEqual(ctx.saves.at(-1).repoFeishuProjects, {});
});

test('failed settings save rolls back the association and name; failed add returns no repositories', async () => {
  let fail = false;
  const ctx = assistantHarness({
    selectDirectory: async () => '/new',
    scanRepositories: async dir => dir === '/new' ? [repoB] : [repoA],
    saveConfig: async config => { if (fail) throw new Error('disk full'); return config; },
  });
  await ctx.assistant.init();
  fail = true;
  await assert.rejects(ctx.assistant.saveRepoSettings([{ path: repoA.path, displayName: '失败名称', project: binding() }]), /disk full/);
  assert.equal(ctx.assistant.getRepoFeishuProject(repoA.path), undefined);
  assert.equal(ctx.assistant.getRepoDisplayName(repoA), 'Project A');
  assert.deepEqual(await ctx.assistant.chooseWorkspace(), []);
  assert.equal(ctx.assistant.sortedRepos.value.some(repo => repo.path === repoB.path), false);
});

test('draft defaults use repository associations, preserve explicit choices, and require consistent combined targets', () => {
  const { assistant } = assistantHarness();
  assistant.config.feishuForm = { ...assistant.config.feishuForm, shareToken: 'form-a', projectFieldId: 'project', projectOptionId: 'global' };
  assistant.config.repoFeishuProjects = { [repoA.path]: binding(), [repoB.path]: binding() };
  assistant.config.feishuForm.projectWorkHours = { b: 6 };
  assert.equal(assistant.createProjectReportDraft(repoA).projectOptionId, 'b');
  assert.equal(assistant.createProjectReportDraft(repoA).workHours, 6);
  assert.equal(assistant.createProjectReportDraft(repoA, { projectOptionId: '' }).projectOptionId, '');
  assert.equal(assistant.createProjectReportDraft(repoA, { projectOptionId: 'manual' }).projectOptionId, 'manual');
  assert.equal(assistant.createProjectReportDraft(repoA, { sourceRepos: [repoA, repoB] }).projectOptionId, 'b');
  delete assistant.config.repoFeishuProjects[repoB.path];
  assert.equal(assistant.createProjectReportDraft(repoA, { sourceRepos: [repoA, repoB] }).projectOptionId, '');
  assert.equal(assistant.createProjectReportDraft(repoB).projectOptionId, 'global');
  assistant.loadDailyReportDraft({ id: 2, repoPaths: [repoA.path], repoNames: [repoA.name], report: '历史正文', status: 'success' });
  assert.equal(assistant.projectDrafts.value[0].projectOptionId, 'b');
  assistant.projectDrafts.value[0].projectOptionId = '';
  assistant.loadDailyReportDraft({ id: 2, repoPaths: [repoA.path], repoNames: [repoA.name], report: '历史正文', status: 'success' });
  assert.equal(assistant.projectDrafts.value[0].projectOptionId, '');
});

test('changing form clears stale targets and options but keeps report content and hours', async () => {
  const scope = effectScope();
  const { assistant } = scope.run(() => assistantHarness());
  await assistant.init();
  assistant.config.repoFeishuProjects = { [repoA.path]: binding() };
  assistant.projectDrafts.value = [assistant.createProjectReportDraft(repoA, { report: '保留正文', workHours: 5 })];
  assistant.config.feishuForm.shareToken = 'form-b';
  await nextTick();
  assert.equal(assistant.getRepoFeishuProject(repoA.path), undefined);
  assert.deepEqual(assistant.projectOptions.value, []);
  assert.equal(assistant.projectDrafts.value[0].projectOptionId, '');
  assert.equal(assistant.projectDrafts.value[0].report, '保留正文');
  assert.equal(assistant.projectDrafts.value[0].workHours, 5);
  scope.stop();
});

test('existing default drafts track saved association changes and clearing while manual choices stay unchanged', async () => {
  const ctx = assistantHarness();
  await ctx.assistant.init();
  const automatic = ctx.assistant.createProjectReportDraft(repoA);
  const manual = ctx.assistant.createProjectReportDraft(repoA, { projectOptionId: 'manual' });
  ctx.assistant.projectDrafts.value = [automatic, manual];
  await ctx.assistant.saveRepoSettings([{ path: repoA.path, project: binding() }]);
  assert.equal(ctx.assistant.projectDrafts.value[0].projectOptionId, 'b');
  assert.equal(ctx.assistant.projectDrafts.value[1].projectOptionId, 'manual');
  await ctx.assistant.saveRepoSettings([{ path: repoA.path, project: binding('c', '项目 C') }]);
  assert.equal(ctx.assistant.projectDrafts.value[0].projectOptionId, 'c');
  await ctx.assistant.saveRepoSettings([{ path: repoA.path, project: null }]);
  assert.equal(ctx.assistant.projectDrafts.value[0].projectOptionId, 'a');
  assert.equal(ctx.assistant.projectDrafts.value[1].projectOptionId, 'manual');
});

test('a failed association save does not reset a successfully published draft', async () => {
  const { assistant } = assistantHarness({ saveConfig: async () => { throw new Error('disk full'); } });
  await assistant.init();
  assistant.projectDrafts.value = [assistant.createProjectReportDraft(repoA, { report: '已提交正文', publishStatus: 'success', publishMessage: '已提交飞书日报' })];
  await assert.rejects(assistant.saveRepoSettings([{ path: repoA.path, project: binding() }]));
  const draft = assistant.projectDrafts.value[0];
  assert.equal(draft.projectOptionId, 'a');
  assert.equal(draft.publishStatus, 'success');
  assert.equal(draft.publishMessage, '已提交飞书日报');
});
