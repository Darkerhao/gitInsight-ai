<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckCircle2, FolderOpen, Pencil, Pin, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const assistant = useAssistant();
const {
  loading,
  sortedRepos,
  selectedRepos,
  status,
  chooseWorkspace,
  refreshRepos,
  toggleRepo,
  isRepoSelected,
  getRepoDisplayName,
  renameRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
} = assistant;

const repoKeyword = ref('');

const pinnedCount = computed(() => sortedRepos.value.filter((repo) => isRepoPinned(repo.path)).length);
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${getRepoDisplayName(repo)} ${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});

const stats = computed(() => [
  { label: '仓库总数', value: sortedRepos.value.length },
  { label: '已选仓库', value: selectedRepos.value.length },
  { label: '置顶仓库', value: pinnedCount.value },
]);

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${getRepoDisplayName(item)}」吗？这不会删除本地仓库文件。`, '移除仓库', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeRepo(item.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除仓库失败');
  }
}

async function promptRenameRepo(repo: RepoInfo) {
  try {
    const { value } = await ElMessageBox.prompt('设置仓库显示名称，留空恢复原名。', '重命名仓库', {
      inputValue: getRepoDisplayName(repo), confirmButtonText: '保存', cancelButtonText: '取消',
    });
    await renameRepo(repo.path, value);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存仓库名称失败');
  }
}
</script>

<template>
  <div class="view-stack">
    <PageHeader title="仓库中心" subtitle="选择日报默认仓库，管理显示名称和置顶顺序">
      <template #actions>
        <el-button :icon="RefreshCw" plain :loading="loading" @click="refreshRepos">刷新仓库</el-button>
        <el-button :icon="Plus" type="primary" @click="chooseWorkspace">添加仓库</el-button>
      </template>
    </PageHeader>

    <section class="repo-center-summary">
      <div v-for="item in stats" :key="item.label" class="repo-stat">
        <span>{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="surface-card repo-center-panel">
      <div class="repo-center-toolbar">
        <div>
          <h3>仓库列表</h3>
          <p>选中的仓库会作为日报生成页的默认范围</p>
        </div>
        <el-input v-model="repoKeyword" :prefix-icon="Search" clearable placeholder="搜索仓库名称或路径" />
      </div>

      <div class="repo-center-list">
        <el-button v-if="!sortedRepos.length" class="repo-center-empty" @click="chooseWorkspace">
          <FolderOpen :size="22" />
          <span>暂无仓库，点击选择工作目录</span>
        </el-button>

        <div
          v-for="repo in filteredRepos"
          :key="repo.path"
          class="repo-center-item"
          :class="{ active: isRepoSelected(repo.path), pinned: isRepoPinned(repo.path) }"
        >
          <el-button class="repo-center-main" text :aria-label="`选择仓库 ${getRepoDisplayName(repo)}`" :aria-pressed="isRepoSelected(repo.path)" @click="toggleRepo(repo.path)">
            <span class="repo-center-check">
              <CheckCircle2 v-if="isRepoSelected(repo.path)" :size="18" />
            </span>
            <span class="repo-center-copy">
              <strong>{{ getRepoDisplayName(repo) }}</strong>
              <small>{{ repo.path }}</small>
            </span>
          </el-button>

          <div class="repo-center-actions">
            <el-button class="repo-action-btn" text :aria-label="`重命名 ${getRepoDisplayName(repo)}`" @click="promptRenameRepo(repo)">
              <Pencil :size="16" />
            </el-button>
            <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
              <el-button
                class="repo-action-btn"
                text
                :class="{ active: isRepoPinned(repo.path) }"
                :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${getRepoDisplayName(repo)}` : `置顶 ${getRepoDisplayName(repo)}`"
                :aria-pressed="isRepoPinned(repo.path)"
                @click.stop="toggleRepoPin(repo.path)"
              >
                <Pin :size="16" />
              </el-button>
            </el-tooltip>

            <el-tooltip content="从列表移除" placement="top">
              <el-button class="repo-action-btn danger" text :aria-label="`移除 ${getRepoDisplayName(repo)}`" @click.stop="confirmRemoveRepo(repo)">
                <Trash2 :size="16" />
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <div v-if="sortedRepos.length && !filteredRepos.length" class="repo-center-empty static">
          <Search :size="22" />
          <span>未找到匹配仓库</span>
        </div>
      </div>

      <p v-if="status" class="muted-text">{{ status }}</p>
    </section>
  </div>
</template>
