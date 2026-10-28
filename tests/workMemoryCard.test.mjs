import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/shared/workMemoryCard.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { buildWorkMemoryCard, renderWorkMemoryCard } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const record = (patch = {}) => ({ date: '2026-10-01', projects: ['Alpha'], commitsCount: 3, filesCount: 7, milestone: true, title: '发布版本', techTags: ['Vue'], ...patch });

test('inclusive date and exact project filters preserve report totals and distinct days/projects', () => {
  const data = buildWorkMemoryCard([
    record(), record({ projects: ['Alpha', 'Beta'] }),
    record({ date: '2026-10-02', milestone: false, techTags: ['Vue', 'SQL'] }),
    record({ date: '2026-09-30' }), record({ projects: ['Alpha%'] }),
  ], { startDate: '2026-10-01', endDate: '2026-10-02', project: 'Alpha' });
  assert.equal(data.reports, 3); assert.equal(data.activeDays, 2);
  assert.equal(data.commits, 9); assert.equal(data.files, 21);
  assert.equal(data.projects, 2); assert.equal(data.milestones, 2);
  assert.deepEqual(data.tags, ['Vue', 'SQL']);
  assert.equal(buildWorkMemoryCard([], {}).reports, 0);
});

test('SVG escapes report text, bounds long content and all three faces render standalone', () => {
  const data = buildWorkMemoryCard([record({ projects: ['<script>&"'], title: '<script>alert(1)</script>', techTags: ['A&B'] })], {});
  for (const id of ['card-paper', 'card-blueprint', 'card-orbit']) {
    const svg = renderWorkMemoryCard(data, id);
    assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes('&lt;script&gt;')); assert.ok(svg.includes('A&amp;B'));
    assert.ok(!svg.includes('<script>')); assert.ok(svg.includes('非去重值'));
  }
  assert.throws(() => renderWorkMemoryCard(data, 'theme-ocean'), /不存在/);
  assert.ok(!renderWorkMemoryCard({ ...data, project: '长'.repeat(1000) }, 'card-paper').includes('长'.repeat(25)));
});
