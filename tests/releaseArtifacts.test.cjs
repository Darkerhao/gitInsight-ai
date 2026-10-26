const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { test } = require('node:test');
const shellTest = process.platform === 'win32' ? test.skip : test;
const { expandMacro } = require('app-builder-lib/out/util/macroExpander');
const { createUpdateInfoTasks, writeUpdateInfoFiles } = require('app-builder-lib/out/publish/updateInfoBuilder');
const { Platform } = require('app-builder-lib');
const { Arch } = require('builder-util');
const { load } = require('js-yaml');
const { minimatch } = require('minimatch');
const packageInfo = require('../package.json');
const { version } = packageInfo;
const workflow = load(readFileSync(join(__dirname, '../.github/workflows/release.yml'), 'utf8'));

test('single product preserves existing profile identity', () => {
  assert.equal(packageInfo.name, 'gitinsight-ai');
  assert.equal(packageInfo.productName, undefined);
  assert.ok(!Object.keys(packageInfo.scripts).some(name => /:(lite|standard)$/.test(name)));
});

test('release assets have unique ASCII names and exclude unpacked executables', () => {
  const allNames = new Set();
  const publishPatterns = workflow.jobs.release.steps.find(step => step.uses?.startsWith('softprops/action-gh-release@')).with.files.trim().split(/\s+/);
  const isPublished = file => publishPatterns.some(pattern => minimatch(file, pattern));
  for (const job of workflow.jobs.package.strategy.matrix.include) {
    const config = require('../electron-builder.config.cjs');
    const platform = { Windows: 'win', macOS: 'mac', Linux: 'linux' }[job.name];
    const info = { version, productName: config.productName, sanitizedProductName: config.productName };
    assert.equal(config.productName, '码迹AI');
    assert.equal(config.appId, 'com.shuzhi.gitinsight-ai');
    assert.equal(config.extraMetadata, undefined);
    assert.equal(config.directories.output, 'release/${version}');
    const patterns = job.paths.trim().split(/\s+/);
    const matches = file => patterns.some(pattern => minimatch(file, pattern));
    const base = `release/${version}`;
    for (const target of config[platform].target) {
      for (const arch of target.arch) {
        const ext = { nsis: 'exe', portable: 'exe' }[target.target] || target.target;
        const pattern = config[target.target]?.artifactName || config[platform].artifactName || config.artifactName;
        const name = expandMacro(pattern, arch, info, { os: platform, ext });
        assert.match(name, /^[A-Za-z0-9.-]+$/);
        assert.ok(name.startsWith(`MajiAI-${version}-`), name);
        assert.ok(!allNames.has(name), `Duplicate release asset: ${name}`);
        allNames.add(name);
        assert.ok(matches(`${base}/${name}`), `Missing upload: ${name}`);
        // Artifact extraction retains the version directory below release/.
        assert.ok(isPublished(`release-assets/${version}/${name}`), `Missing release asset: ${name}`);
        assert.ok(!matches(`${base}/win-unpacked/${name}`));
      }
    }
    assert.ok(!matches(`${base}/win-unpacked/elevate.exe`));
    assert.ok(!matches(`${base}/win-unpacked/码迹AI.exe`));
    assert.ok(!matches(`${base}/elevate.exe`));
    assert.ok(matches(`${base}/MajiAI-${version}-Windows-x64.exe.blockmap`));
    assert.equal(config.publish.channel, 'standard', 'Keep the existing Standard installation update channel');
    assert.equal(config.publish.owner, 'Darkerhao');
    assert.equal(config.publish.repo, 'gitInsight-ai');
    const suffix = { Windows: '', macOS: '-mac', Linux: '-linux' }[job.name];
    const manifest = `${config.publish.channel}${suffix}.yml`;
    assert.ok(!allNames.has(manifest), `Duplicate update manifest: ${manifest}`);
    allNames.add(manifest);
    assert.ok(matches(`${base}/${manifest}`), `Missing manifest upload: ${manifest}`);
    assert.ok(isPublished(`release-assets/${version}/${manifest}`), `Missing published manifest: ${manifest}`);
    assert.ok(!matches(`${base}/latest${suffix}.yml`), 'Use the existing standard update channel');
  }
});

test('only main pushes publish, after checks and all packages from one commit', () => {
  assert.deepEqual(workflow.on.push, { branches: ['main'] });
  assert.ok(Object.hasOwn(workflow.on, 'workflow_dispatch'));
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  assert.equal(workflow.jobs.prepare.needs, 'verify');
  assert.equal(workflow.jobs.verify.if, "github.ref == 'refs/heads/main'", 'Manual builds must also stay on main');
  assert.equal(workflow.jobs.verify.uses, './.github/workflows/checks.yml');
  const checks = load(readFileSync(join(__dirname, '../.github/workflows/checks.yml'), 'utf8'));
  assert.deepEqual(checks.on.pull_request, { branches: ['dev', 'main'] });
  assert.deepEqual(checks.on.push, { branches: ['dev'] });
  assert.ok(Object.hasOwn(checks.on, 'workflow_call'));
  assert.ok(!checks.on.push.branches.includes('main'), 'main must not run the same checks twice');
  assert.equal(workflow.jobs.package.needs, 'prepare');
  assert.equal(workflow.jobs.package.if, "needs.prepare.outputs.ready == 'true'");
  const checkout = workflow.jobs.package.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.with.ref, '${{ needs.prepare.outputs.ref }}');
  assert.equal(workflow.jobs.package.strategy.matrix.include.length, 3);
  const sync = workflow.jobs['sync-dev'];
  assert.equal(sync.needs, 'prepare');
  assert.equal(sync.if, "needs.prepare.outputs.tag != ''");
  assert.equal(sync.permissions.contents, 'write');
  assert.equal(sync.steps[0].with.ref, '${{ needs.prepare.outputs.ref }}');
  assert.equal(sync.steps[0].with['fetch-depth'], 0);
  assert.equal(sync.steps.find(step => step.id === 'sync').env.VERSION_COMMIT, '${{ needs.prepare.outputs.ref }}');
  assert.deepEqual(workflow.jobs.release.needs, ['prepare', 'package']);
  assert.equal(workflow.jobs.release.if, "needs.prepare.outputs.tag != ''");
  const publishers = Object.values(workflow.jobs).flatMap(job => job.steps || [])
    .filter(step => step.uses?.startsWith('softprops/action-gh-release@'));
  assert.equal(publishers.length, 1);
  assert.equal(publishers[0].with.tag_name, '${{ needs.prepare.outputs.tag }}');
  assert.equal(publishers[0].with.draft, true, 'Clients must not see a release before all assets are uploaded');
  const publishComplete = workflow.jobs.release.steps.at(-1);
  assert.equal(publishComplete.env.RELEASE_TAG, '${{ needs.prepare.outputs.tag }}');
  assert.match(publishComplete.run, /gh release edit .*--draft=false --latest/);
});

test('electron-builder generates unified manifests with actual hashes and both Mac architectures', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'maji-update-manifests-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const job of workflow.jobs.package.strategy.matrix.include) {
    const config = require('../electron-builder.config.cjs');
    const platform = { Windows: Platform.WINDOWS, macOS: Platform.MAC, Linux: Platform.LINUX }[job.name];
    const outDir = join(directory, job.artifact);
    mkdirSync(outDir);
    const emitted = [];
    const packager = {
      config, platform, platformSpecificBuildOptions: config[platform.buildConfigurationKey],
      appInfo: { version }, info: { metadata: require('../package.json') },
      getResource: async () => null,
      emitArtifactCreated: async event => emitted.push(event.file),
    };
    const targets = job.name === 'Windows' ? [['exe', 'x64']]
      : job.name === 'macOS' ? [['zip', 'x64'], ['zip', 'arm64']]
        : [['AppImage', 'x64'], ['deb', 'x64'], ['rpm', 'x64']];
    const tasks = [];
    for (const [ext, arch] of targets) {
      const name = `MajiAI-${version}-${platform.buildConfigurationKey}-${arch}.${ext}`;
      const file = join(outDir, name);
      writeFileSync(file, `Fixture installer ${name}`);
      tasks.push(...await createUpdateInfoTasks({ file, packager, target: { outDir }, arch: Arch[arch] }, [config.publish]));
    }
    await writeUpdateInfoFiles(tasks, packager);
    const suffix = job.name === 'Windows' ? '' : `-${platform.buildConfigurationKey}`;
    const manifestPath = join(outDir, `${config.publish.channel}${suffix}.yml`);
    assert.deepEqual(emitted, [manifestPath]);
    const manifest = load(readFileSync(manifestPath, 'utf8'));
    assert.equal(manifest.version, version);
    assert.equal(manifest.files.length, targets.length);
    for (const file of manifest.files) {
      assert.ok(file.url.startsWith(`MajiAI-${version}-`));
      assert.equal(file.sha512, createHash('sha512').update(readFileSync(join(outDir, file.url))).digest('base64'));
    }
    if (job.name === 'macOS') {
      assert.ok(manifest.files.some(file => file.url.includes('-arm64.zip')));
      assert.ok(manifest.files.some(file => file.url.includes('-x64.zip')));
    }
  }
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
  function run(eventName = 'push', sourceSha = sha) {
    writeFileSync(outputFile, '');
    const result = spawnSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', scriptFile.replaceAll('\\', '/')], {
      cwd: checkout,
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...process.env, GITHUB_EVENT_NAME: eventName, GITHUB_SHA: sourceSha,
        GITHUB_OUTPUT: outputFile.replaceAll('\\', '/'),
      },
    });
    const output = Object.fromEntries(readFileSync(outputFile, 'utf8').trim().split('\n').filter(Boolean)
      .map(line => line.trim().split('=')));
    return { ...result, output };
  }
  return { remote, checkout, git, sha, run };
}

function versionSyncFixture(t) {
  const fixture = releaseFixture(t);
  const { checkout, git, sha, run } = fixture;
  // Each branch has independent work; only the generated version patch may cross.
  git('checkout', '--detach', sha);
  writeFileSync(join(checkout, 'dev-only.txt'), 'Development work');
  git('add', 'dev-only.txt');
  git('commit', '-m', 'Development work');
  const devSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:refs/heads/dev');
  git('checkout', '--detach', sha);
  writeFileSync(join(checkout, 'main-only.txt'), 'Main-only change');
  git('add', 'main-only.txt');
  git('commit', '-m', 'Main-only change');
  const sourceSha = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:refs/heads/main');
  const prepared = run('push', sourceSha);
  assert.equal(prepared.status, 0, prepared.stderr);
  const versionCommit = prepared.output.ref;
  const scriptFile = join(checkout, '.git', 'sync-version.sh');
  writeFileSync(scriptFile, workflow.jobs['sync-dev'].steps.find(step => step.id === 'sync').run);
  const gitExecPath = git('--exec-path');
  const bash = process.platform === 'win32' ? resolve(gitExecPath, '../../../bin/bash.exe') : 'bash';
  const sync = () => spawnSync(bash, ['--noprofile', '--norc', '-e', '-o', 'pipefail', scriptFile.replaceAll('\\', '/')], {
    cwd: checkout, encoding: 'utf8', timeout: 20_000, env: { ...process.env, VERSION_COMMIT: versionCommit },
  });
  return { ...fixture, versionCommit, devSha, sync };
}

shellTest('version sync cherry-picks only the version commit onto dev and is safe to retry', t => {
  const { remote, git, devSha, versionCommit, sync } = versionSyncFixture(t);
  const result = sync();
  assert.equal(result.status, 0, result.stderr);
  const synced = git('--git-dir', remote, 'rev-parse', 'dev');
  assert.equal(git('rev-parse', `${synced}^`), devSha);
  assert.deepEqual(git('diff-tree', '--no-commit-id', '--name-only', '-r', synced).split('\n'), ['package-lock.json', 'package.json']);
  assert.equal(git('show', `${synced}:dev-only.txt`), 'Development work');
  assert.ok(!git('ls-tree', '--name-only', synced).includes('main-only.txt'));
  assert.ok(git('log', '-1', '--format=%B', synced).includes(`(cherry picked from commit ${versionCommit})`));
  assert.equal(JSON.parse(git('show', `${synced}:package.json`)).version, '3.8.7');
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), versionCommit);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'v3.8.7'), versionCommit);
  const retry = sync();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'dev'), synced);
});

shellTest('version conflicts leave dev untouched and abort the cherry-pick', t => {
  const { remote, checkout, git, devSha, sync } = versionSyncFixture(t);
  git('checkout', '--detach', devSha);
  const file = join(checkout, 'package.json');
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  pkg.version = '4.0.0';
  writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  git('add', 'package.json');
  git('commit', '-m', 'Prepare next major version');
  const newer = git('rev-parse', 'HEAD');
  git('push', 'origin', 'HEAD:refs/heads/dev');
  const result = sync();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Version sync conflicted/);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'dev'), newer);
  assert.equal(git('status', '--porcelain'), '');
});

shellTest('a concurrent dev push rejects version sync without losing development work', t => {
  const { remote, checkout, git, devSha, sync } = versionSyncFixture(t);
  git('checkout', '--detach', devSha);
  git('commit', '--allow-empty', '-m', 'Concurrent development');
  const newer = git('rev-parse', 'HEAD');
  // Make the object available on the remote, then advance dev during pre-push.
  git('push', 'origin', `${newer}:refs/heads/concurrent-fixture`);
  writeFileSync(join(checkout, '.git', 'hooks', 'pre-push'),
    `#!/bin/sh\ngit --git-dir='${remote.replaceAll('\\', '/')}' update-ref refs/heads/dev ${newer}\n`, { mode: 0o755 });
  const result = sync();
  assert.notEqual(result.status, 0);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'dev'), newer);
});

shellTest('dev branch protection failures preserve the prepared main version and tag', t => {
  const { remote, git, devSha, versionCommit, sync } = versionSyncFixture(t);
  writeFileSync(join(remote, 'hooks', 'update'), '#!/bin/sh\ncase "$1" in refs/heads/dev) exit 1 ;; esac\n', { mode: 0o755 });
  const result = sync();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hook declined/);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'dev'), devSha);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), versionCommit);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'v3.8.7'), versionCommit);
});

shellTest('main release bumps both manifests and atomically pushes the version commit and tag', t => {
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

shellTest('manual builds preserve the selected commit and do not create release refs', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  const result = run('workflow_dispatch');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.output, { ready: 'true', ref: sha });
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'tag', '--list'), '');
  assert.equal(git('status', '--porcelain'), '');
});

shellTest('an outdated push cannot bump or overwrite newer main changes', t => {
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

shellTest('an existing remote version tag prevents a release without changing main', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  // Create the tag only on the remote, like a concurrent writer after checkout.
  git('--git-dir', remote, 'tag', 'v3.8.7', sha);
  const result = run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.output, {});
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'rev-parse', 'v3.8.7'), sha);
});

shellTest('remote tag protection rejects the atomic push without leaving a version commit on main', t => {
  const { remote, git, sha, run } = releaseFixture(t);
  writeFileSync(join(remote, 'hooks/update'), '#!/bin/sh\ncase "$1" in refs/tags/*) exit 1 ;; esac\n', { mode: 0o755 });
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /atomic push failure|hook declined/);
  assert.deepEqual(result.output, {});
  assert.equal(git('--git-dir', remote, 'rev-parse', 'main'), sha);
  assert.equal(git('--git-dir', remote, 'tag', '--list'), '');
});
