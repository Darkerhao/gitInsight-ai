<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, FolderGit2, FolderOpen, Link2, Pencil, Pin, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const router = useRouter();
const {
  config, loading, sortedRepos, selectedRepos, chooseWorkspace, refreshRepos, toggleRepo,
  isRepoSelected, getRepoDisplayName, isRepoPinned, toggleRepoPin, removeRepo,
  getRepoFeishuProject, saveRepoSettings, projectOptions, projectLoading, loadFeishuProjects,
} = useAssistant();

const repoKeyword = ref('');
const editorVisible = ref(false);
const saving = ref(false);
const addedRepos = ref(false);
const editingRepos = ref<{ path: string; displayName: string; projectId: string }[]>([]);
const canLoadProjects = computed(() => Boolean(config.feishuForm.shareToken && config.feishuForm.projectFieldId));
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  return sortedRepos.value.filter(repo => `${getRepoDisplayName(repo)} ${repo.name} ${repo.path} ${getRepoFeishuProject(repo.path)?.name ?? ''}`.toLocaleLowerCase().includes(keyword));
});
const linkedCount = computed(() => sortedRepos.value.filter(repo => getRepoFeishuProject(repo.path)).length);
const stats = computed(() => [
  { label: '仓库总数', value: sortedRepos.value.length, icon: FolderGit2 },
  { label: '默认生成仓库', value: selectedRepos.value.length, icon: Check },
  { label: '已关联飞书', value: linkedCount.value, icon: Link2 },
]);

function openEditor(repos: RepoInfo[], added = false) {
  addedRepos.value = added;
  editingRepos.value = repos.map(repo => ({
    path: repo.path, displayName: getRepoDisplayName(repo), projectId: getRepoFeishuProject(repo.path)?.id ?? '',
  }));
  editorVisible.value = true;
  if (canLoadProjects.value) void loadFeishuProjects({ background: true });
}

async function addRepositories() {
  const repos = await chooseWorkspace();
  if (repos.length) openEditor(repos, true);
}

async function saveSettings() {
  saving.value = true;
  try {
    const changes = editingRepos.value.map(repo => {
      const project = projectOptions.value.find(item => item.id === repo.projectId);
      if (repo.projectId && !project) throw new Error('所选飞书项目已变化，请重新选择');
      return { path: repo.path, displayName: repo.displayName, project: project ?? null };
    });
    await saveRepoSettings(changes);
    editorVisible.value = false;
    ElMessage.success('仓库设置已保存');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存仓库设置失败');
  } finally {
    saving.value = false;
  }
}

async function confirmRemoveRepo(repo: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${getRepoDisplayName(repo)}」吗？本地文件会保留，仓库关联将清除。`, '移除仓库', {
      confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning',
    });
    await removeRepo(repo.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除仓库失败');
  }
}
</script>

<template>
  <div class="view-stack repo-center-page">
    <PageHeader title="仓库中心" subtitle="关联飞书项目，生成日报时自动带入提交目标">
      <template #actions>
        <el-button :icon="RefreshCw" plain :loading="loading" @click="refreshRepos">刷新仓库</el-button>
        <el-button :icon="Plus" type="primary" :disabled="loading" @click="addRepositories">添加仓库</el-button>
      </template>
    </PageHeader>

    <section class="repo-center-summary">
      <div v-for="item in stats" :key="item.label" class="repo-stat">
        <div class="repo-stat-label"><component :is="item.icon" :size="16" /><span>{{ item.label }}</span></div>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="surface-card repo-center-panel">
      <div class="repo-center-toolbar">
        <div><h3>仓库列表</h3><p>勾选仓库设为日报默认范围，关联项目后无需重复选择</p></div>
        <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称、路径或飞书项目" aria-label="搜索仓库" />
      </div>
      <div v-if="filteredRepos.length" class="repo-center-columns" aria-hidden="true">
        <span>仓库</span><span>飞书项目</span><span>操作</span>
      </div>
      <div class="repo-center-list">
        <div v-if="!sortedRepos.length" class="repo-center-empty static">
          <FolderOpen :size="28" /><strong>添加第一个仓库</strong>
          <span>选择 Git 仓库或包含多个仓库的工作目录</span>
          <el-button :icon="Plus" type="primary" :disabled="loading" @click="addRepositories">选择工作目录</el-button>
        </div>
        <div v-for="repo in filteredRepos" :key="repo.path" class="repo-center-item" :class="{ active: isRepoSelected(repo.path) }">
          <button class="repo-center-main" :aria-label="`选择仓库 ${getRepoDisplayName(repo)}`" :aria-pressed="isRepoSelected(repo.path)" @click="toggleRepo(repo.path)">
            <span class="repo-center-check"><Check v-if="isRepoSelected(repo.path)" :size="14" :stroke-width="3" /></span>
            <span class="repo-center-copy">
              <span class="repo-center-name"><strong>{{ getRepoDisplayName(repo) }}</strong><span v-if="isRepoPinned(repo.path)" class="repo-pinned-label"><Pin :size="11" />置顶</span></span>
              <small :title="repo.path">{{ repo.path }}</small>
            </span>
          </button>
          <button class="repo-project-link" :class="{ linked: getRepoFeishuProject(repo.path) }" :aria-label="`关联飞书项目 ${getRepoDisplayName(repo)}`" :title="getRepoFeishuProject(repo.path)?.name || '设置仓库的飞书项目'" @click="openEditor([repo])">
            <Link2 :size="15" /><span>{{ getRepoFeishuProject(repo.path)?.name || '关联飞书项目' }}</span><Pencil :size="12" class="repo-project-edit" />
          </button>
          <div class="repo-center-actions">
            <el-tooltip content="编辑名称与关联项目" placement="top">
              <el-button class="repo-action-btn" text :aria-label="`重命名 ${getRepoDisplayName(repo)}`" @click="openEditor([repo])"><Pencil :size="16" /></el-button>
            </el-tooltip>
            <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
              <el-button class="repo-action-btn" text :class="{ active: isRepoPinned(repo.path) }" :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${getRepoDisplayName(repo)}` : `置顶 ${getRepoDisplayName(repo)}`" :aria-pressed="isRepoPinned(repo.path)" @click="toggleRepoPin(repo.path)"><Pin :size="16" /></el-button>
            </el-tooltip>
            <el-tooltip content="从列表移除" placement="top">
              <el-button class="repo-action-btn danger" text :aria-label="`移除 ${getRepoDisplayName(repo)}`" @click="confirmRemoveRepo(repo)"><Trash2 :size="16" /></el-button>
            </el-tooltip>
          </div>
        </div>
        <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-center-empty static"><Search :size="24" /><span>未找到匹配仓库</span></div>
      </div>
      <div class="repo-center-footer"><span>共 {{ sortedRepos.length }} 个仓库 · 已选 {{ selectedRepos.length }} 个</span><span><Link2 :size="14" />关联项目后，日报提交目标自动带入，仍可手动调整</span></div>
    </section>

    <el-dialog v-model="editorVisible" :title="addedRepos ? '仓库已添加 · 关联飞书项目' : '仓库设置'" width="620px" class="repo-settings-dialog" append-to-body :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving">
      <p class="repo-editor-intro">{{ addedRepos ? '为本次添加的仓库设置飞书项目，也可以稍后在仓库列表中关联。' : '设置显示名称和默认提交项目，之后生成日报会自动带入。' }}</p>
      <div class="repo-editor-projects-toolbar">
        <span>飞书项目可搜索，留空时沿用日报默认项目</span>
        <el-button v-if="canLoadProjects" :icon="RefreshCw" text :loading="projectLoading" :disabled="saving" @click="loadFeishuProjects({ background: true })">刷新项目</el-button>
        <el-button v-else type="primary" text :disabled="saving" @click="editorVisible = false; router.push('/config')">连接飞书</el-button>
      </div>
      <el-alert v-if="!canLoadProjects" title="尚未连接飞书，可先保存仓库，连接后再关联项目。" type="info" :closable="false" show-icon />
      <el-form label-position="top" class="repo-editor-form" :disabled="saving">
        <div v-for="repo in editingRepos" :key="repo.path" class="repo-editor-entry">
          <div class="repo-editor-path"><FolderGit2 :size="16" /><span>{{ repo.path }}</span></div>
          <el-form-item label="仓库显示名称"><el-input v-model="repo.displayName" maxlength="60" placeholder="输入显示名称，留空恢复原名" /></el-form-item>
          <el-form-item label="关联飞书项目">
            <el-select v-model="repo.projectId" filterable clearable :value-on-clear="''" :loading="projectLoading" :disabled="!canLoadProjects" placeholder="选择飞书项目（可选）" no-data-text="暂无项目，请刷新项目或检查飞书配置" style="width: 100%">
              <el-option v-for="project in projectOptions" :key="project.id" :value="project.id" :label="project.name || project.id" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="editorVisible = false">{{ addedRepos ? '稍后关联' : '取消' }}</el-button>
        <el-button type="primary" :loading="saving" @click="saveSettings">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
