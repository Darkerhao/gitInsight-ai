<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus';
import { Bot, ClipboardList, FileCog, FileText, History, Home, Pin, Plus, Settings, Sparkles, Trash2 } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import type { RepoInfo } from '@shared/types';

const props = defineProps<{
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
}>();

const assistant = useAssistant();
const { sortedRepos, selectedRepoPaths, toggleRepo, isRepoPinned, toggleRepoPin, chooseWorkspace, removeRepo } = assistant;

const navItems = [
  { key: 'dashboard', label: '工作台', icon: Home, enabled: true },
  { key: 'config', label: '日报配置', icon: FileCog, enabled: true },
  { key: 'generate', label: '日报生成', icon: FileText, enabled: true },
  { key: 'sync', label: '同步任务', icon: ClipboardList, enabled: true },
  { key: 'history', label: '历史日志', icon: History, enabled: true },
  { key: 'system', label: '系统设置', icon: Settings, enabled: true },
];

function onNav(item: (typeof navItems)[number]) {
  if (!item.enabled) return;
  emit('update:activeNav', item.key);
}

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从项目列表移除「${item.name}」吗？这不会删除本地项目文件。`, '移除项目', {
      confirmButtonText: '移除',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await removeRepo(item.path);
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '移除项目失败');
  }
}

void props;
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo">A</div>
      <span class="sidebar-brand-name">AI日报助手</span>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.key"
        class="nav-item"
        :class="{ active: item.enabled && activeNav === item.key, disabled: !item.enabled }"
        @click="onNav(item)"
      >
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar-projects">
      <div class="sidebar-projects-head">
        <span>项目列表</span>
        <span v-if="sortedRepos.length" class="sidebar-projects-count">{{ sortedRepos.length }} 个</span>
        <el-button link type="primary" size="small" :icon="Plus" @click="chooseWorkspace">
          新建项目
        </el-button>
      </div>
      <div class="sidebar-projects-list">
        <div
          v-for="item in sortedRepos"
          :key="item.path"
          class="project-card"
          :class="{ active: selectedRepoPaths.includes(item.path), pinned: isRepoPinned(item.path) }"
        >
          <button type="button" class="project-card-main" @click="toggleRepo(item.path)">
            <div class="project-card-head">
              <span class="project-dot" />
              <strong>{{ item.name }}</strong>
            </div>
            <span class="project-path">{{ item.path }}</span>
          </button>
          <el-tooltip :content="isRepoPinned(item.path) ? '取消置顶' : '置顶项目'" placement="right">
            <button
              type="button"
              class="project-pin"
              :class="{ active: isRepoPinned(item.path) }"
              :aria-label="isRepoPinned(item.path) ? `取消置顶 ${item.name}` : `置顶 ${item.name}`"
              :aria-pressed="isRepoPinned(item.path)"
              @click.stop="toggleRepoPin(item.path)"
            >
              <Pin :size="14" />
            </button>
          </el-tooltip>
          <el-tooltip content="从列表移除" placement="right">
            <button type="button" class="project-delete" :aria-label="`移除 ${item.name}`" @click.stop="confirmRemoveRepo(item)">
              <Trash2 :size="14" />
            </button>
          </el-tooltip>
        </div>
        <button v-if="!sortedRepos.length" class="project-empty" @click="chooseWorkspace">
          暂无仓库，点击选择工作目录
        </button>
      </div>
    </div>

    <div class="sidebar-tip">
      <div class="sidebar-tip-icon"><Bot :size="28" /></div>
      <div class="sidebar-tip-title">
        <Sparkles :size="14" />
        <span>AI 助手小贴士</span>
      </div>
      <p class="sidebar-tip-desc">让日报生成更智能</p>
      <button class="sidebar-tip-btn" @click="ElMessage.info('敬请期待')">了解更多</button>
    </div>
  </aside>
</template>
