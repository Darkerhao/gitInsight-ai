import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const remote = process.argv[2] || 'origin';
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const version = packageJson.version;
const tagName = `v${version}`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: options.quiet ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    throw new Error(detail || `Command failed: ${command} ${args.join(' ')}`);
  }

  return result;
}

function getOutput(command, args) {
  return run(command, args, { quiet: true, allowFailure: true }).stdout.trim();
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version: ${version}`);
}

const status = getOutput('git', ['status', '--porcelain']);
if (status) {
  throw new Error('Working tree is not clean. Commit or stash changes before creating a release tag.');
}

const localTag = run('git', ['rev-parse', '--verify', `refs/tags/${tagName}`], {
  quiet: true,
  allowFailure: true,
});

if (localTag.status === 0) {
  throw new Error(`Local tag already exists: ${tagName}`);
}

const remoteTag = getOutput('git', ['ls-remote', '--tags', remote, `refs/tags/${tagName}`]);
if (remoteTag) {
  throw new Error(`Remote tag already exists on ${remote}: ${tagName}`);
}

console.log(`Creating release tag ${tagName} from package.json version ${version}`);
run('git', ['tag', tagName]);
run('git', ['push', remote, tagName]);
console.log(`Pushed ${tagName} to ${remote}`);
