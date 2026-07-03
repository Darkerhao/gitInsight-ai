import { readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { RepoInfo } from '../../src/shared/types.js';

export const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', 'coverage', '.idea', '.vscode']);

export async function hasGitMetadata(dir: string) {
  try {
    const info = await stat(join(dir, '.git'));
    return info.isDirectory() || info.isFile();
  } catch {
    return false;
  }
}


export async function scanRepositories(rootDir: string): Promise<RepoInfo[]> {
  const repos: RepoInfo[] = [];
  const stack = [resolve(rootDir)];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    if (await hasGitMetadata(current)) {
      repos.push({ name: basename(current), path: current });
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      stack.push(join(current, entry.name));
    }
  }

  return repos.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
}

