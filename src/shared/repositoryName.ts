import type { RepoInfo } from './types.js';

export const MAX_REPO_DISPLAY_NAME_LENGTH = 60;

export function getRepoPathKey(path: string) {
  return path.trim().toLocaleLowerCase();
}

export function normalizeRepoDisplayName(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_REPO_DISPLAY_NAME_LENGTH) : '';
}

export function normalizeRepoDisplayNames(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([path, displayName]) => [getRepoPathKey(path), normalizeRepoDisplayName(displayName)] as const)
      .filter(([path, displayName]) => path && displayName),
  );
}

export function getRepoDisplayName(repo: RepoInfo, displayNames: Record<string, string>) {
  return displayNames[getRepoPathKey(repo.path)] || repo.name;
}

export function setRepoDisplayName(displayNames: Record<string, string>, path: string, value: unknown) {
  const next = normalizeRepoDisplayNames(displayNames);
  const pathKey = getRepoPathKey(path);
  const displayName = normalizeRepoDisplayName(value);
  if (displayName) next[pathKey] = displayName;
  else delete next[pathKey];
  return next;
}

export function matchesRepoKeyword(repo: RepoInfo, displayNames: Record<string, string>, keyword: string) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return true;
  return `${getRepoDisplayName(repo, displayNames)} ${repo.name} ${repo.path}`
    .toLocaleLowerCase()
    .includes(normalizedKeyword);
}
