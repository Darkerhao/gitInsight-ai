import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rendererRoot = join(root, 'src', 'renderer', 'src');

async function read(relativePath) {
  return readFile(join(root, relativePath), 'utf8');
}

const app = await read('src/renderer/src/App.vue');
const sidebar = await read('src/renderer/src/components/AppSidebar.vue');
const topbar = await read('src/renderer/src/components/AppTopbar.vue');
const generate = await read('src/renderer/src/views/ReportGenerateView.vue');
const indexStyles = await read('src/renderer/src/styles/index.scss');
const atelierStyles = await read('src/renderer/src/styles/_atelier.scss');

assert.match(app, /app-atmosphere/, 'app shell should expose the atmospheric canvas layer');
assert.match(app, /handlePointerMove/, 'app shell should wire pointer feedback');
assert.match(app, /pointerVelocity/, 'pointer feedback should use a damped spring state');
assert.match(app, /requestAnimationFrame/, 'pointer feedback should be frame-scheduled');
assert.match(app, /handleScroll/, 'app shell should expose scroll progress feedback');
assert.match(sidebar, /lucide-vue-next/, 'sidebar icons must come from Lucide');
assert.match(sidebar, /atelier-sidebar/, 'sidebar should use the atelier shell');
assert.match(topbar, /topbar-command/, 'topbar should expose the command/status rail');
assert.match(topbar, /topbar-zoom/, 'topbar should expose page zoom controls');
assert.match(app, /handlePageZoomShortcut/, 'app shell should support page zoom shortcuts');
assert.match(generate, /atelier-page/, 'report generation should opt into the atelier page treatment');
assert.match(generate, /data-stage="scope"/, 'scope stage should be addressable for interaction styling');
assert.match(generate, /data-stage="publish"/, 'publish stage should be addressable for interaction styling');
assert.match(generate, /activeWorkflowStage/, 'workflow rail should expose the current stage');
assert.match(generate, /IntersectionObserver/, 'workflow stage should follow scroll position');
assert.match(generate, /aria-current/, 'workflow stage should expose current-step semantics');
assert.match(indexStyles, /@use ['"]atelier['"]/, 'atelier stylesheet must be loaded last');
assert.match(atelierStyles, /prefers-reduced-motion/, 'atelier motion must have an accessibility fallback');
assert.match(atelierStyles, /\.atelier-workflow-step\.active/, 'active workflow stage needs visible feedback');

const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
async function assertNoEmoji(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await assertNoEmoji(absolutePath);
      continue;
    }
    if (!entry.name.endsWith('.vue')) continue;
    const source = await readFile(absolutePath, 'utf8');
    assert.equal(emojiPattern.test(source), false, `emoji found in ${absolutePath}`);
  }
}

await assertNoEmoji(rendererRoot);
console.log('ui-shell smoke: pass');
