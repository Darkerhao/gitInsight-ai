import { computed } from 'vue';
import type { Ref } from 'vue';
import { ElMessage } from 'element-plus';
import type { AppConfig, RepoInfo } from '@shared/types';
import { normalizeRepoSelections, normalizeWorkspaceDirs } from './normalizers';

type RepoStateContext = {
  config: AppConfig;
  repos: Ref<RepoInfo[]>;
  selectedRepoPaths: Ref<string[]>;
  loading: Ref<boolean>;
  status: Ref<string>;
  persistConfig: () => Promise<AppConfig>;
};

export function createRepoState(ctx: RepoStateContext) {
  const { config, repos, selectedRepoPaths, loading, status, persistConfig } = ctx;

  function getRepoKey(path: string) {
    return path.trim().toLocaleLowerCase();
  }


  function getWorkspaceDirs() {
    const workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, config.workspaceDir]);
    config.workspaceDirs = workspaceDirs;
    return workspaceDirs;
  }


  function mergeRepos(currentRepos: RepoInfo[], nextRepos: RepoInfo[]) {
    const repoMap = new Map<string, RepoInfo>();
    for (const repo of [...currentRepos, ...nextRepos]) {
      repoMap.set(getRepoKey(repo.path), repo);
    }
    return Array.from(repoMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  }


  function filterIgnoredRepos(repoItems: RepoInfo[]) {
    const ignoredRepoKeys = new Set(normalizeRepoSelections(config.ignoredRepoPaths ?? []).map(getRepoKey));
    return repoItems.filter((repo) => !ignoredRepoKeys.has(getRepoKey(repo.path)));
  }


  function sortReposForDisplay(repoItems: RepoInfo[]) {
    const pinnedOrder = new Map(normalizeRepoSelections(config.pinnedRepoPaths ?? []).map((path, index) => [getRepoKey(path), index]));
    return [...repoItems].sort((a, b) => {
      const pinnedA = pinnedOrder.get(getRepoKey(a.path));
      const pinnedB = pinnedOrder.get(getRepoKey(b.path));
      if (pinnedA !== undefined && pinnedB !== undefined) return pinnedA - pinnedB;
      if (pinnedA !== undefined) return -1;
      if (pinnedB !== undefined) return 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });
  }


  async function scanWorkspaceDirs(workspaceDirs: string[], options: { includeIgnored?: boolean } = {}) {
    const scannedGroups = await Promise.all(workspaceDirs.map((workspaceDir) => window.api.scanRepositories(workspaceDir)));
    const scannedRepos = scannedGroups.flat();
    return options.includeIgnored ? scannedRepos : filterIgnoredRepos(scannedRepos);
  }


  const pinnedRepoKeys = computed(() => new Set(normalizeRepoSelections(config.pinnedRepoPaths ?? []).map(getRepoKey)));

  const sortedRepos = computed(() => sortReposForDisplay(repos.value));

  const selectedRepos = computed(() => sortedRepos.value.filter((item) => selectedRepoPaths.value.includes(item.path)));

  async function chooseWorkspace() {
    const dir = await window.api.selectDirectory();
    if (!dir) return;

    loading.value = true;
    try {
      const scannedRepos = await scanWorkspaceDirs([dir], { includeIgnored: true });
      if (!scannedRepos.length) {
        status.value = '所选目录下未识别到 Git 仓库';
        ElMessage.warning('未在所选目录下识别到 Git 仓库，请选择包含 .git 的项目目录或工作区');
        return;
      }

      config.workspaceDir = dir;
      config.workspaceDirs = normalizeWorkspaceDirs([...config.workspaceDirs, dir]);
      const scannedRepoKeys = new Set(scannedRepos.map((repo) => getRepoKey(repo.path)));
      config.ignoredRepoPaths = normalizeRepoSelections((config.ignoredRepoPaths ?? []).filter((path) => !scannedRepoKeys.has(getRepoKey(path))));
      repos.value = mergeRepos(repos.value, scannedRepos);
      selectedRepoPaths.value = normalizeRepoSelections([...selectedRepoPaths.value, ...scannedRepos.map((repo) => repo.path)]);
      await persistConfig();
      status.value = `已添加 ${scannedRepos.length} 个仓库，当前共 ${repos.value.length} 个仓库`;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      loading.value = false;
    }
  }


  async function refreshRepos() {
    const workspaceDirs = getWorkspaceDirs();
    if (!workspaceDirs.length) {
      repos.value = [];
      selectedRepoPaths.value = [];
      return;
    }

    loading.value = true;
    try {
      repos.value = mergeRepos([], await scanWorkspaceDirs(workspaceDirs));
      const repoPathSet = new Set(repos.value.map((repo) => getRepoKey(repo.path)));
      const selectedPaths = selectedRepoPaths.value.filter((path) => repoPathSet.has(getRepoKey(path)));
      const firstDisplayRepo = sortReposForDisplay(repos.value)[0];
      selectedRepoPaths.value = selectedPaths.length || !firstDisplayRepo ? selectedPaths : [firstDisplayRepo.path];
      config.selectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
      status.value = `已扫描到 ${repos.value.length} 个仓库`;
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '扫描失败');
    } finally {
      loading.value = false;
    }
  }


  async function saveRepoSelection() {
    try {
      await persistConfig();
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存项目选择失败');
    }
  }


  function toggleRepo(path: string) {
    const hasSelected = selectedRepoPaths.value.includes(path);
    if (hasSelected) {
      selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => item !== path);
    } else {
      selectedRepoPaths.value = [...selectedRepoPaths.value, path];
    }
    void saveRepoSelection();
  }


  function isRepoPinned(path: string) {
    return pinnedRepoKeys.value.has(getRepoKey(path));
  }


  async function toggleRepoPin(path: string) {
    const repo = repos.value.find((item) => getRepoKey(item.path) === getRepoKey(path));
    const repoPath = repo?.path ?? path;
    const repoKey = getRepoKey(repoPath);
    const pinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []);
    const alreadyPinned = pinnedRepoPaths.some((item) => getRepoKey(item) === repoKey);
    config.pinnedRepoPaths = alreadyPinned
      ? pinnedRepoPaths.filter((item) => getRepoKey(item) !== repoKey)
      : [repoPath, ...pinnedRepoPaths.filter((item) => getRepoKey(item) !== repoKey)];

    try {
      await persistConfig();
      ElMessage.success(alreadyPinned ? '已取消置顶项目' : '项目已置顶');
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '保存项目置顶状态失败');
    }
  }


  async function removeRepo(path: string) {
    const repo = repos.value.find((item) => getRepoKey(item.path) === getRepoKey(path));
    const repoPath = repo?.path ?? path;
    const repoKey = getRepoKey(repoPath);
    repos.value = repos.value.filter((item) => getRepoKey(item.path) !== repoKey);
    selectedRepoPaths.value = selectedRepoPaths.value.filter((item) => getRepoKey(item) !== repoKey);
    config.selectedRepoPaths = normalizeRepoSelections(selectedRepoPaths.value);
    config.ignoredRepoPaths = normalizeRepoSelections([...(config.ignoredRepoPaths ?? []), repoPath]);
    config.pinnedRepoPaths = normalizeRepoSelections(config.pinnedRepoPaths ?? []).filter((item) => getRepoKey(item) !== repoKey);
    config.workspaceDirs = normalizeWorkspaceDirs((config.workspaceDirs ?? []).filter((item) => getRepoKey(item) !== repoKey));
    if (getRepoKey(config.workspaceDir) === repoKey) {
      config.workspaceDir = config.workspaceDirs[0] ?? '';
    }
    await persistConfig();
    status.value = `已从项目列表移除 ${repo?.name ?? repoPath}`;
    ElMessage.success('项目已从列表移除，本地文件不会被删除');
  }



  return {
    getRepoKey,
    getWorkspaceDirs,
    mergeRepos,
    filterIgnoredRepos,
    sortReposForDisplay,
    scanWorkspaceDirs,
    sortedRepos,
    selectedRepos,
    chooseWorkspace,
    refreshRepos,
    saveRepoSelection,
    toggleRepo,
    isRepoPinned,
    toggleRepoPin,
    removeRepo,
  };
}
