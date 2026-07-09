import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { getEncoding } from 'js-tiktoken';
import type { TokenScanProgress, TokenScanRecord } from '../../src/shared/types.js';
import { IGNORED_DIRS } from './repoScan.js';
import { recordTokenScan } from './tokenUsageDb.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.svelte',
  '.py', '.go', '.rs', '.java', '.kt', '.c', '.cpp', '.h',
  '.css', '.scss', '.less', '.html',
  '.json', '.yaml', '.yml', '.toml',
  '.md', '.txt',
  '.sql', '.sh', '.bat', '.ps1',
]);

const SCAN_IGNORED_DIRS = new Set([
  ...IGNORED_DIRS,
  '__pycache__', '.next', '.nuxt', 'vendor', '.venv', 'target',
  '.cache', '.parcel-cache', '.turbo', 'tmp', 'temp',
]);

const MAX_FILE_SIZE = 1024 * 1024; // 1MB


async function collectCodeFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SCAN_IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          stack.push(join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          files.push(join(current, entry.name));
        }
      }
    }
  }

  return files;
}


let cachedEncoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!cachedEncoder) {
    cachedEncoder = getEncoding('cl100k_base');
  }
  return cachedEncoder;
}


async function countFileTokens(filePath: string): Promise<number> {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_FILE_SIZE) return 0;
    const content = await readFile(filePath, 'utf-8');
    const encoder = getEncoder();
    return encoder.encode(content).length;
  } catch {
    return 0;
  }
}


export async function scanProjectTokens(
  repoPaths: string[],
  onProgress?: (progress: TokenScanProgress) => void,
): Promise<TokenScanRecord[]> {
  const results: TokenScanRecord[] = [];

  for (const repoPath of repoPaths) {
    const repoName = basename(repoPath);
    const codeFiles = await collectCodeFiles(repoPath);
    const breakdown: Record<string, number> = {};
    let totalTokens = 0;

    for (let i = 0; i < codeFiles.length; i++) {
      const filePath = codeFiles[i];
      const ext = extname(filePath).toLowerCase().replace('.', '');
      const tokens = await countFileTokens(filePath);
      totalTokens += tokens;
      breakdown[ext] = (breakdown[ext] || 0) + tokens;

      onProgress?.({
        repoName,
        scannedFiles: i + 1,
        totalFiles: codeFiles.length,
        currentTokens: totalTokens,
      });
    }

    const record = await recordTokenScan({
      repoPath,
      repoName,
      totalFiles: codeFiles.length,
      totalTokens,
      breakdown,
    });
    results.push(record);
  }

  return results;
}
