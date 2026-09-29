const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { test } = require('node:test');
const { expandMacro } = require('app-builder-lib/out/util/macroExpander');
const { load } = require('js-yaml');
const { minimatch } = require('minimatch');
const { version } = require('../package.json');
const workflow = load(readFileSync(join(__dirname, '../.github/workflows/release.yml'), 'utf8'));

test('release assets have unique ASCII names and exclude unpacked executables', () => {
  const originalEdition = process.env.APP_EDITION;
  const allNames = new Set();
  const publishPattern = workflow.jobs.release.steps.find(step => step.uses?.startsWith('softprops/action-gh-release@')).with.files;
  try {
    for (const job of workflow.jobs.package.strategy.matrix.include) {
      process.env.APP_EDITION = job.edition;
      delete require.cache[require.resolve('../electron-builder.config.cjs')];
      const config = require('../electron-builder.config.cjs');
      const platform = { Windows: 'win', macOS: 'mac', Linux: 'linux' }[job.name];
      const info = { version, productName: config.productName, sanitizedProductName: config.productName };
      assert.match(config.productName, /^码迹 AI /);
      const patterns = job.paths.trim().split(/\s+/);
      const matches = file => patterns.some(pattern => minimatch(file, pattern));
      const base = `release/${version}/${job.edition}`;
      for (const target of config[platform].target) {
        for (const arch of target.arch) {
          const ext = { nsis: 'exe', portable: 'exe' }[target.target] || target.target;
          const pattern = config[target.target]?.artifactName || config[platform].artifactName || config.artifactName;
          const name = expandMacro(pattern, arch, info, { os: platform, ext });
          assert.match(name, /^[A-Za-z0-9.-]+$/);
          assert.ok(name.startsWith(`MajiAI-${job.editionLabel}-`), name);
          assert.ok(!allNames.has(name), `Duplicate release asset: ${name}`);
          allNames.add(name);
          assert.ok(matches(`${base}/${name}`), `Missing upload: ${name}`);
          // Artifact extraction retains the version/edition directories below release/.
          assert.ok(minimatch(`release-assets/${version}/${job.edition}/${name}`, publishPattern), `Missing release asset: ${name}`);
          assert.ok(!matches(`${base}/win-unpacked/${name}`));
        }
      }
      assert.ok(!matches(`${base}/win-unpacked/elevate.exe`));
      assert.ok(!matches(`${base}/win-unpacked/码迹 AI 标准版.exe`));
      assert.ok(!matches(`${base}/elevate.exe`));
      assert.ok(matches(`${base}/MajiAI-${job.editionLabel}-${version}-Windows-x64.exe.blockmap`));
    }
  } finally {
    if (originalEdition === undefined) delete process.env.APP_EDITION;
    else process.env.APP_EDITION = originalEdition;
    delete require.cache[require.resolve('../electron-builder.config.cjs')];
  }
});

test('only main pushes publish, after checks and all packages from one commit', () => {
  assert.deepEqual(workflow.on.push, { branches: ['main'] });
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.prepare.needs, 'verify');
  assert.equal(workflow.jobs.verify.uses, './.github/workflows/checks.yml');
  const checks = load(readFileSync(join(__dirname, '../.github/workflows/checks.yml'), 'utf8'));
  assert.ok(Object.hasOwn(checks.on, 'pull_request'));
  assert.ok(Object.hasOwn(checks.on, 'workflow_call'));
  assert.ok(!checks.on.push.branches.includes('main'), 'main must not run the same checks twice');
  assert.equal(workflow.jobs.package.needs, 'prepare');
  assert.equal(workflow.jobs.package.if, "needs.prepare.outputs.ready == 'true'");
  const checkout = workflow.jobs.package.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ needs.prepare.outputs.ref }}');
  assert.equal(workflow.jobs.package.strategy.matrix.include.length, 6);
  assert.deepEqual(workflow.jobs.release.needs, ['prepare', 'package']);
  assert.equal(workflow.jobs.release.if, "needs.prepare.outputs.tag != ''");
  const publishers = Object.values(workflow.jobs).flatMap(job => job.steps || [])
    .filter(step => step.uses?.startsWith('softprops/action-gh-release@'));
  assert.equal(publishers.length, 1);
  assert.equal(publishers[0].with.tag_name, '${{ needs.prepare.outputs.tag }}');
});

// Run the actual workflow shell step against disposable local repositories.
function releaseFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'maji-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, 'origin.git');
  const checkout = join(root, 'checkout');
  mkdirSync(checkout);
  const git = (...args) => execFileSync('git', args, { cwd: checkout, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '--bare', remote);
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release-test@example.com');
  writeFileSync(join(checkout, 'package.json'), JSON.stringify({ name: 'release-test', version: '3.8.6', private: true }, null, 2) + '\n');
  writeFileSync(join(checkout, 'package-lock.json'), JSON.stringify({
    name: 'release-test', version: '3.8.6', lockfileVersion: 3,
    packages: { '': { name: 'release-test', version: '3.8.6' } },
  }, null, 2) + '\n');
  git('add', '.');
  git('commit', '-m', 'Initial version');
  git('remote', 'add', 'origin', remote);
  git('push', '-u', 'origin', 'main');
  const sha = git('rev-parse', 'HEAD');
  git('checkout', '--detach', sha);
  const outputFile = join(root, 'github-output');
  const scriptFile = join(root, 'prepare.sh');
  writeFileSync(scriptFile, workflow.jobs.prepare.steps.find(step => step.id === 'version').run);
  const gitExecPath = git('--exec-path');
  const bash = process.platform === 'win32' ? resolve(gitExecPath, '../../../bin/bash.exe') : 'bash';
  function run(eventName = 'push') {
    writeFileSync(outputFile, '');
    const result = spawnSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', scriptFile.replaceAll('\\', '/')], {
      cwd: checkout,
      encoding: 'utf8',
      env: {
        ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_SHA: sha,
        GITHUB_OUTPUT: outputFile.replaceAll('\\', '/'),
      },
    });
    const output = Object.fromEntries(readFileSync(outputFile, 'utf8').trim().split('\n').filter(Boolean)
      .map(line => line.trim().split('=')));
    return { ...result, output };
  }
  return { remote, checkout, git, sha, run };
}

test('main release bumps both manifests and atomically pushes the version commit and tag', t => {
  const { remote, checkout, git, sha, run } = releaseFixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.output.ready, 'true');
  assert.equal(result.output.tag, 'v3.8.7');
  assert.notEqual(result.output.ref, sha);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), result.output.ref);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'v3.8.7'), result.output.ref);
  assert.equal(git('rev-parse', 'HEAD^'), sha);
  const pkg = JSON.parse(readFileSync(join(checkout, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(join(checkout, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.version, '3.8.7');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(git('status', '--porcelain'), '');
  // Re-running all jobs for the old source must not create another version.
  assert.deepEqual(run().output, { ready: 'false' });
  assert.equal(git('--git-dir', remote, 'tag', '--list'), 'v3.8.7');
});

test('manual builds preserve the selected commit and do not create release refs', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  const result = run('workflow_dispatch');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, { ready: 'true', ref: sha });
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'tag', '--list'), '');
  assert.equal(git('status', '--porcelain'), '');
});

test('an outdated push cannot bump or overwrite newer main changes', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  git('commit', '--allow-empty', '-m', 'Newer change');
  const newer = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:main');
  git('checkout', '--detach', sha);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, { ready: 'false' });
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), newer);
  assert.equal(git('--git-dir', remote, 'tag', '--list'), '');
  assert.equal(git('status', '--porcelain'), '');
});

test('an existing remote version tag prevents a release without changing main', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  // Create the tag only on the remote, like a concurrent writer after checkout.
  git('--git-dir', remote, 'tag', 'v3.8.7', sha);
  const result = run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.output, {});
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'v3.8.7'), sha);
});

test('remote tag protection rejects the atomic push without leaving a version commit on main', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  writeFileSync(join(remote, 'hooks/update'), '#!/bin/sh\ncase "$1" in refs/tags/*) exit 1 ;; esac\n', { mode: 0o755 });
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /atomic push failure|hook declined/);
  assert.deepEqual(result.output, {});
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'tag', '--list'), '');
});
