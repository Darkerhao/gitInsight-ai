import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runGenerationQueue, projectGenerationInput, restoredManualWorkContent } from '../src/renderer/src/composables/assistant/projectGeneration.js';

test('project input only includes its own material', () => {
  assert.deepEqual(projectGenerationInput({ repo: { path: 'a' }, manualWorkContent: ' A review ' }), { repoPaths: ['a'], manualWorkContent: 'A review' });
  assert.deepEqual(projectGenerationInput({ repo: { path: 'b' }, manualWorkContent: '' }), { repoPaths: ['b'], manualWorkContent: undefined });
  assert.equal(restoredManualWorkContent('legacy material', 0), 'legacy material');
  assert.equal(restoredManualWorkContent('legacy material', 1), '');
});

test('queue limits concurrency to three and retains ordered results', async () => {
  let active = 0;
  let peak = 0;
  const results = await runGenerationQueue([0, 1, 2, 3, 4], async (item) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item * 2;
  }, new AbortController().signal);
  assert.equal(peak, 3);
  assert.deepEqual(results, [0, 2, 4, 6, 8]);
});

test('cancellation stops queued work and preserves completed results', async () => {
  const controller = new AbortController();
  const started: number[] = [];
  const results = await runGenerationQueue([0, 1, 2, 3, 4], async (item) => {
    started.push(item);
    if (item === 0) controller.abort();
    return item;
  }, controller.signal);
  assert.deepEqual(started, [0]);
  assert.equal(results[0], 0);
  assert.equal(results[4], undefined);
});
