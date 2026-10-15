import type { AppConfig, FeishuProjectOption, RepoFeishuProject, RepoInfo } from './types.js';
import { getRepoPathKey } from './repositoryName.js';

export function normalizeRepoFeishuProjects(value: unknown): Record<string, RepoFeishuProject> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries: [string, RepoFeishuProject][] = [];
  for (const [path, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Record<string, unknown>;
    const text = (key: string) => typeof source[key] === 'string' ? source[key].trim() : '';
    const project = { id: text('id'), name: text('name'), shareToken: text('shareToken'), projectFieldId: text('projectFieldId') };
    if (getRepoPathKey(path) && project.id && project.shareToken && project.projectFieldId) entries.push([getRepoPathKey(path), project]);
  }
  return Object.fromEntries(entries);
}

export function getRepoFeishuProject(config: AppConfig, path: string): RepoFeishuProject | undefined {
  const project = config.repoFeishuProjects?.[getRepoPathKey(path)];
  return project?.shareToken === config.feishuForm.shareToken.trim()
    && project?.projectFieldId === config.feishuForm.projectFieldId.trim()
    ? project : undefined;
}

export function resolveRepoFeishuProject(config: AppConfig, repos: RepoInfo[]): string {
  const targets = repos.map(repo => getRepoFeishuProject(config, repo.path)?.id ?? config.feishuForm.projectOptionId?.trim() ?? '');
  return targets.length && targets.every(id => id === targets[0]) ? targets[0] : '';
}

export function withRepoFeishuOptions(config: AppConfig, options: FeishuProjectOption[]): FeishuProjectOption[] {
  const byId = new Map<string, FeishuProjectOption>();
  if (config.feishuForm.projectOptionId) byId.set(config.feishuForm.projectOptionId, { id: config.feishuForm.projectOptionId, name: config.feishuForm.projectName });
  for (const path of Object.keys(config.repoFeishuProjects ?? {})) {
    const project = getRepoFeishuProject(config, path);
    if (project) byId.set(project.id, { id: project.id, name: project.name || project.id });
  }
  for (const option of options) byId.set(option.id, option);
  return [...byId.values()];
}
