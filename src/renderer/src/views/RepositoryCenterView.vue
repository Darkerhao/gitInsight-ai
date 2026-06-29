<script setup lang="ts">
import { computed, ref } from 'vue';
import { CheckCircle2, FolderOpen, Pin, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageHeader from '@/components/common/PageHeader.vue';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const assistant = useAssistant();
const {
  loading,
  sortedRepos,
  selectedRepoPaths,
  selectedRepos,
  status,
  chooseWorkspace,
  refreshRepos,
  toggleRepo,
  isRepoPinned,
  toggleRepoPin,
  removeRepo,
} = assistant;

const repoKeyword = ref('');

const pinnedCount = computed(() => sortedRepos.value.filter((repo) => isRepoPinned(repo.path)).length);
const filteredRepos = computed(() => {
  const keyword = repoKeyword.value.trim().toLocaleLowerCase();
  if (!keyword) return sortedRepos.value;
  return sortedRepos.value.filter((repo) => `${repo.name} ${repo.path}`.toLocaleLowerCase().includes(keyword));
});

const stats = computed(() => [
  { label: '仓库总数', value: sortedRepos.value.length },
  { label: '已选仓库', value: selectedRepos.value.length },
  { label: '置顶仓库', value: pinnedCount.value },
]);

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从仓库中心移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
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
</script>

<template>
  <div class="view-stack">
    <PageHeader title="仓库中心" subtitle="统一管理日报可用仓库，侧边栏只保留全局导航">
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
        <button v-if="!sortedRepos.length" type="button" class="repo-center-empty" @click="chooseWorkspace">
          <FolderOpen :size="22" />
          <span>暂无仓库，点击选择工作目录</span>
        </button>

        <div
          v-for="repo in filteredRepos"
          :key="repo.path"
          class="repo-center-item"
          :class="{ active: selectedRepoPaths.includes(repo.path), pinned: isRepoPinned(repo.path) }"
        >
          <button type="button" class="repo-center-main" @click="toggleRepo(repo.path)">
            <span class="repo-center-check">
              <CheckCircle2 v-if="selectedRepoPaths.includes(repo.path)" :size="18" />
            </span>
            <span class="repo-center-copy">
              <strong>{{ repo.name }}</strong>
              <small>{{ repo.path }}</small>
            </span>
          </button>

          <div class="repo-center-actions">
            <el-tooltip :content="isRepoPinned(repo.path) ? '取消置顶' : '置顶仓库'" placement="top">
              <button
                type="button"
                class="repo-action-btn"
                :class="{ active: isRepoPinned(repo.path) }"
                :aria-label="isRepoPinned(repo.path) ? `取消置顶 ${repo.name}` : `置顶 ${repo.name}`"
                :aria-pressed="isRepoPinned(repo.path)"
                @click.stop="toggleRepoPin(repo.path)"
              >
                <Pin :size="16" />
              </button>
            </el-tooltip>

            <el-tooltip content="从列表移除" placement="top">
              <button type="button" class="repo-action-btn danger" :aria-label="`移除 ${repo.name}`" @click.stop="confirmRemoveRepo(repo)">
                <Trash2 :size="16" />
              </button>
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
