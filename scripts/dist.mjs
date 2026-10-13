import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

console.log('正在构建码迹 AI 安装包...');
run('npm', ['run', 'build']);
run('npx', ['electron-builder', '--config', 'electron-builder.config.cjs', ...process.argv.slice(2)]);
