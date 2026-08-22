import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = {
  page: await readFile(new URL('../src/renderer/src/views/WeeklySummaryView.vue', import.meta.url), 'utf8'),
  workflow: await readFile(new URL('../src/renderer/src/composables/useWeeklySummary.ts', import.meta.url), 'utf8'),
  router: await readFile(new URL('../src/renderer/src/router.ts', import.meta.url), 'utf8'),
  app: await readFile(new URL('../src/renderer/src/App.vue', import.meta.url), 'utf8'),
  sidebar: await readFile(new URL('../src/renderer/src/components/AppSidebar.vue', import.meta.url), 'utf8'),
  preload: await readFile(new URL('../electron/preload.ts', import.meta.url), 'utf8'),
  ipc: await readFile(new URL('../electron/main/ipc.ts', import.meta.url), 'utf8'),
};

assert.match(files.router, /summary\|reflection/, 'summary route should be registered');
assert.match(files.app, /summary: WeeklySummaryView/, 'summary view should be mounted');
assert.match(files.sidebar, /key: 'summary'.+会议周报/, 'summary should have a navigation item');
assert.match(files.page, /选择工作周/, 'page should explain the weekly workflow');
assert.match(files.page, /上一周/, 'page should expose previous week shortcut');
assert.match(files.page, /生成周报/, 'page should expose generation action');
assert.match(files.page, /查看来源日报/, 'page should expose source drawer');
assert.match(files.page, /复制 Markdown/, 'page should expose markdown copy');
assert.match(files.workflow, /generateWeeklySummary/, 'workflow should call generation API');
assert.match(files.workflow, /saveWeeklySummary/, 'workflow should call save API');
assert.match(files.workflow, /navigator\.clipboard\.writeText/, 'workflow should support copy');
assert.match(files.preload, /weekly-summary:generate/, 'preload should expose generation channel');
assert.match(files.ipc, /weekly-summary:save/, 'main IPC should expose save channel');

console.log('weekly summary page smoke: pass');
