import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../src/renderer/src/views/WeeklyReflectionView.vue', import.meta.url), 'utf8');
const workflow = await readFile(new URL('../src/renderer/src/composables/useWeeklyReflection.ts', import.meta.url), 'utf8');
const router = await readFile(new URL('../src/renderer/src/router.ts', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/renderer/src/App.vue', import.meta.url), 'utf8');
const sidebar = await readFile(new URL('../src/renderer/src/components/AppSidebar.vue', import.meta.url), 'utf8');
const preload = await readFile(new URL('../electron/preload.ts', import.meta.url), 'utf8');

assert.match(router, /weekly\|reflection\|history/, 'reflection route should be registered beside report routes');
assert.match(app, /reflection: WeeklyReflectionView/, 'reflection view should be mounted by the app shell');
assert.match(sidebar, /key: 'reflection'.+label: '项目周反思'/, 'reflection page should have a report-center menu item');
assert.match(page, /useWeeklyReflection/, 'reflection page should use the dedicated workflow composable');
assert.match(page, /做得好的地方/, 'reflection result should render strengths');
assert.match(page, /后续改进动作/, 'reflection result should render improvements');
assert.match(workflow, /generateWeeklyReflection/, 'workflow should call the typed generation API');
assert.match(workflow, /selectHistory\(history\.value\[0\]\)/, 'latest history should restore its project and date filters');
assert.match(workflow, /navigator\.clipboard\.writeText/, 'reflection result should be copyable');
assert.match(workflow, /text\/markdown/, 'reflection result should be exportable as markdown');
assert.match(preload, /weekly-reflection:generate/, 'preload should expose the reflection generation channel');

console.log('weekly reflection page smoke: pass');
