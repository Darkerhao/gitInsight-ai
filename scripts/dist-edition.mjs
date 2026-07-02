import { spawnSync } from 'node:child_process';

const allowedEditions = new Set(['lite', 'standard']);
const rawArgs = process.argv.slice(2);
const builderArgs = [];
let edition = process.env.APP_EDITION || 'lite';

for (let index = 0; index < rawArgs.length; index += 1) {
  const arg = rawArgs[index];
  if (arg === '--edition') {
    edition = rawArgs[index + 1] || edition;
    index += 1;
    continue;
  }
  if (arg.startsWith('--edition=')) {
    edition = arg.split('=')[1] || edition;
    continue;
  }
  builderArgs.push(arg);
}

if (!allowedEditions.has(edition)) {
  throw new Error(`Invalid APP_EDITION: ${edition}. Expected "lite" or "standard".`);
}

const env = {
  ...process.env,
  APP_EDITION: edition,
};

function run(command, args) {
  const result = spawnSync(command, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

console.log(`Building GitInsight AI ${edition === 'standard' ? 'Standard' : 'Lite'} package...`);
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--config', 'electron-builder.config.cjs', ...builderArgs]);
