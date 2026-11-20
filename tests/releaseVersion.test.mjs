import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const script = fileURLToPath(new URL('../scripts/release-version.mjs', import.meta.url));

function repository(t, { tagged = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'maji-version-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, content) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  };
  const commit = message => { git('add', '.'); git('commit', '--allow-empty', '-m', message); };
  const plan = (...args) => JSON.parse(execFileSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' }));
  const notes = () => {
    const path = join(cwd, '.git', 'release-notes.md');
    plan('--notes-file', path);
    return readFileSync(path, 'utf8');
  };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Version test');
  git('config', 'user.email', 'version-test@example.com');
  write('package.json', JSON.stringify({ version: '3.8.19' }));
  write('src/existing.ts', 'export const existing = true;\n');
  commit('feat: existing released feature');
  if (tagged) git('tag', 'v3.8.19');
  return { cwd, git, write, commit, plan, notes };
}

test('release notes contain direct commit details instead of only a comparison link', t => {
  const { commit, notes } = repository(t);
  commit('fix(ui): 收敛配置入口并完善页面体验\n\n- 统一配置保存、复制反馈和无障碍导航\n\n- 修复校验竞态并保护正在使用的 AI 候选项\n\n验证：测试通过\n\n(cherry picked from commit abcdef)');
  commit('chore(release): v3.8.20');
  commit("Merge branch 'dev'");
  assert.equal(notes(), '## 更新内容\n\n- 收敛配置入口并完善页面体验\n  - 统一配置保存、复制反馈和无障碍导航\n  - 修复校验竞态并保护正在使用的 AI 候选项\n');
});

test('release notes keep all new subjects and safely preserve literal markup', t => {
  const { commit, notes } = repository(t);
  commit('feat: 新增日报筛选');
  commit('修复 <日报> 与 A&B 显示');
  const text = notes();
  assert.match(text, /- 新增日报筛选/);
  assert.match(text, /- 修复 &lt;日报&gt; 与 A&amp;B 显示/);
  assert.doesNotMatch(text, /existing released feature/);
});

test('release notes exclude previously published cherry-picked fixes', t => {
  const { git, write, commit, notes } = repository(t);
  const shared = git('rev-parse', 'HEAD');
  write('src/published.ts', 'publishedFix();\n');
  commit('fix: 已经发布的修复');
  const published = git('rev-parse', 'HEAD');
  git('tag', '-f', 'v3.8.19');
  git('checkout', '-b', 'dev', shared);
  commit('chore(release): v3.8.19');
  git('cherry-pick', published);
  write('src/new.ts', 'newFix();\n');
  commit('fix: 本次新增的修复');
  const text = notes();
  assert.match(text, /本次新增的修复/);
  assert.doesNotMatch(text, /已经发布的修复|chore\(release\)/);
});

test('release notes handle the first release and an unchanged release explicitly', t => {
  const first = repository(t, { tagged: false });
  assert.match(first.notes(), /existing released feature/);
  const unchanged = repository(t);
  assert.equal(unchanged.notes(), '## 更新内容\n\n本次没有新增变更。\n');
});

test('a small fix uses patch and the released feature is excluded', t => {
  const { write, commit, plan } = repository(t);
  write('src/fix.ts', 'export const fixed = true;\n');
  commit('fix(report): correct prompt');
  assert.deepEqual(plan(), {
    baseTag: 'v3.8.19', commits: 1, files: 1, additions: 1, deletions: 0,
    bump: 'patch', reason: '小规模修复或维护',
  });
});

for (const message of ['feat(report): add prompt', 'refactor: consolidate\n\nfeat(report): add prompt']) {
  test(`features in the complete commit message use minor: ${message}`, t => {
    const { write, commit, plan } = repository(t);
    write('src/feature.ts', 'export const feature = true;\n');
    commit(message);
    assert.equal(plan().bump, 'minor');
  });
}

for (const message of ['feat(api)!: replace contract', 'fix!: remove support',
  'refactor: replace storage\n\nBREAKING CHANGE: existing data needs migration',
  'refactor: replace storage\n\nBREAKING-CHANGE: existing data needs migration']) {
  test(`explicit breaking changes use major: ${message}`, t => {
    const { commit, plan } = repository(t);
    commit('feat: earlier compatible feature');
    commit(message);
    assert.equal(plan().bump, 'major');
  });
}

test('all commits since the tag are analyzed, not just the final fix or merge', t => {
  const { commit, plan } = repository(t);
  commit('feat(report): new report');
  commit('fix(report): polish report');
  commit("Merge branch 'dev'");
  assert.equal(plan().commits, 3);
  assert.equal(plan().bump, 'minor');
});

test('ordinary prose mentioning feat or an exclamation mark is not a feature', t => {
  const { commit, plan } = repository(t);
  commit('fix: correct label!\n\nThis fixes a feat mentioned in the docs.');
  assert.equal(plan().bump, 'patch');
});

for (const lines of [499, 500, 5000]) {
  test(`${lines} changed code lines respect the minor threshold without inferring major`, t => {
    const { write, commit, plan } = repository(t);
    write('src/large.ts', Array.from({ length: lines }, (_, i) => `export const n${i} = ${i};`).join('\n') + '\n');
    commit('refactor: reorganize code');
    assert.equal(plan().additions, lines);
    assert.equal(plan().bump, lines < 500 ? 'patch' : 'minor');
  });
}

for (const files of [19, 20]) {
  test(`${files} changed files respect the minor threshold`, t => {
    const { write, commit, plan } = repository(t);
    for (let i = 0; i < files; i++) write(`src/file${i}.ts`, `export const n${i} = true;\n`);
    commit('refactor: update modules');
    assert.equal(plan().files, files);
    assert.equal(plan().bump, files < 20 ? 'patch' : 'minor');
  });
}

test('large deletions count toward the code threshold', t => {
  const { cwd, git, write, commit, plan } = repository(t);
  write('electron/old.ts', 'old();\n'.repeat(500));
  commit('feat: old functionality');
  git('tag', '-f', 'v3.8.19');
  rmSync(join(cwd, 'electron/old.ts'));
  commit('refactor: simplify implementation');
  assert.equal(plan().deletions, 500);
  assert.equal(plan().bump, 'minor');
});

test('locks, docs, tests, generated files and binary assets do not inflate code size', t => {
  const { write, commit, plan } = repository(t);
  for (const path of ['package-lock.json', 'docs/guide.md', 'tests/large.test.ts', 'src/example.spec.ts',
    'src/__tests__/large.ts', 'out/main.js', 'release/app.js', '.ai_state/design.md', 'src/assets/picture.svg']) {
    write(path, 'ignored\n'.repeat(600));
  }
  write('src/assets/image.png', Buffer.from([0, 1, 2, 0]));
  commit('chore: refresh supporting files');
  assert.equal(plan().files, 0);
  assert.equal(plan().additions, 0);
  assert.equal(plan().bump, 'patch');
});

test('runtime, packaging and root build configuration changes count', t => {
  const { write, commit, plan } = repository(t);
  for (const path of ['electron/main.ts', 'scripts/dist.mjs', 'build/installer.nsh', 'electron.vite.config.ts',
    'electron-builder.config.cjs', 'tsconfig.json', 'src/renderer/page.vue', 'src/renderer/style.scss']) {
    write(path, 'changed\n');
  }
  commit('fix: update configuration');
  assert.equal(plan().files, 8);
});

test('pure renames do not inflate changes, while edits during a rename count', t => {
  const { git, write, commit, plan } = repository(t);
  write('src/original.ts', Array.from({ length: 600 }, (_, i) => `line${i}();`).join('\n') + '\n');
  commit('feat: existing module');
  git('tag', '-f', 'v3.8.19');
  git('mv', 'src/original.ts', 'src/renamed.ts');
  commit('refactor: rename module');
  assert.equal(plan().files, 0);
  assert.equal(plan().bump, 'patch');
  write('src/renamed.ts', readFileSync(join(git('rev-parse', '--show-toplevel'), 'src/renamed.ts'), 'utf8') + 'changed();\n');
  commit('fix: adjust renamed module');
  assert.equal(plan().files, 1);
  assert.equal(plan().additions, 1);
});

test('current version tag works on dev when the version commit was cherry-picked', t => {
  const { git, write, commit, plan } = repository(t);
  git('tag', '-d', 'v3.8.19');
  const shared = git('rev-parse', 'HEAD');
  commit('chore(release): v3.8.19');
  git('tag', 'v3.8.19');
  git('checkout', '-b', 'dev', shared);
  commit('chore(release): v3.8.19 (synced)');
  write('src/fix.ts', 'fixed();\n');
  commit('fix: small follow-up');
  assert.equal(plan().baseTag, 'v3.8.19');
  assert.equal(plan().bump, 'patch');
  assert.equal(plan().additions, 1);
});

test('already released cherry-picked features are excluded before and after merging dev', t => {
  const { git, write, commit, plan } = repository(t);
  git('tag', '-d', 'v3.8.19');
  const shared = git('rev-parse', 'HEAD');
  write('src/feature.ts', 'released();\n');
  commit('feat: already released feature');
  const feature = git('rev-parse', 'HEAD');
  commit('chore(release): v3.8.19');
  git('tag', 'v3.8.19');
  git('checkout', '-b', 'dev', shared);
  commit('chore: independent dev history');
  git('cherry-pick', feature);
  commit('chore(release): v3.8.19 (synced)');
  write('src/fix.ts', 'fixed();\n');
  commit('fix: small follow-up');
  assert.equal(plan().bump, 'patch');
  assert.equal(plan().additions, 1);
  git('checkout', 'main');
  git('merge', '--no-ff', 'dev', '-m', "Merge branch 'dev'");
  assert.equal(plan().bump, 'patch');
  assert.equal(plan().additions, 1);
});

test('a reverted feature reintroduced after the release still uses minor', t => {
  const { git, write, commit, plan } = repository(t);
  write('src/optional.ts', 'optionalFeature();\n');
  commit('feat: optional feature');
  const feature = git('rev-parse', 'HEAD');
  git('revert', '--no-edit', feature);
  git('tag', '-f', 'v3.8.19');
  git('cherry-pick', feature);
  assert.equal(plan().additions, 1);
  assert.equal(plan().bump, 'minor');
});

test('an untagged manually changed version uses the last reachable stable tag', t => {
  const { git, write, commit, plan } = repository(t);
  git('tag', 'v99.0.0-beta.1');
  write('package.json', JSON.stringify({ version: '3.9.0' }));
  commit('chore: prepare version');
  assert.equal(plan().baseTag, 'v3.8.19');
  assert.equal(plan().bump, 'patch');
});

test('the first release analyzes the complete history', t => {
  const { plan } = repository(t, { tagged: false });
  assert.equal(plan().baseTag, null);
  assert.equal(plan().additions, 1);
  assert.equal(plan().bump, 'minor');
});

test('preview leaves manifests, index and Git refs unchanged', t => {
  const { cwd, git, commit, plan } = repository(t);
  commit('fix: maintenance');
  const before = { head: git('rev-parse', 'HEAD'), refs: git('show-ref'), status: git('status', '--porcelain'),
    pkg: readFileSync(join(cwd, 'package.json'), 'utf8') };
  plan();
  assert.deepEqual({ head: git('rev-parse', 'HEAD'), refs: git('show-ref'), status: git('status', '--porcelain'),
    pkg: readFileSync(join(cwd, 'package.json'), 'utf8') }, before);
});

test('CI output records the decision and a readable summary', t => {
  const { cwd, write, commit } = repository(t);
  write('src/feature.ts', 'newFeature();\n');
  commit('feat: new report feature');
  const output = join(cwd, '.git', 'github-output');
  const summary = join(cwd, '.git', 'summary.md');
  execFileSync(process.execPath, [script, '--github-output'], {
    cwd, env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(readFileSync(output, 'utf8'), 'bump=minor\n');
  assert.match(readFileSync(summary, 'utf8'), /v3\.8\.19/);
  assert.match(readFileSync(summary, 'utf8'), /\+1 \/ -0/);
  assert.match(readFileSync(summary, 'utf8'), /minor/);
});
