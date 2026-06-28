<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Bot, ChevronDown, CircleHelp, ClipboardList, FileCog, FileText, FolderKanban, History, Home, Info, MessageCircle, Pin, Plus, Settings, Sparkles, Trash2 } from 'lucide-vue-next';
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

type NavLeaf = { key: string; label: string; icon: any; enabled: boolean };
type NavGroup = { id: string; label: string; icon: any; children: NavLeaf[] };
type NavNode = NavLeaf | NavGroup;

const navNodes: NavNode[] = [
  { key: 'dashboard', label: '工作台', icon: Home, enabled: true },
  {
    id: 'report',
    label: '日报中心',
    icon: FolderKanban,
    children: [
      { key: 'config', label: '日报配置', icon: FileCog, enabled: true },
      { key: 'generate', label: '日报生成', icon: FileText, enabled: true },
      { key: 'sync', label: '同步任务', icon: ClipboardList, enabled: true },
      { key: 'history', label: '历史日志', icon: History, enabled: true },
    ],
  },
  { key: 'messages', label: '消息', icon: MessageCircle, enabled: true },
  {
    id: 'settings',
    label: '设置',
    icon: Settings,
    children: [
      { key: 'system', label: '系统设置', icon: Settings, enabled: true },
      { key: 'help', label: '使用帮助', icon: CircleHelp, enabled: true },
      { key: 'about', label: '关于我们', icon: Info, enabled: true },
    ],
  },
];

function isGroup(node: NavNode): node is NavGroup {
  return 'children' in node;
}

// 找出当前激活项所属的分组 id（用于自动展开）
const activeGroupId = computed(() => {
  for (const node of navNodes) {
    if (isGroup(node) && node.children.some((c) => c.key === props.activeNav)) {
      return node.id;
    }
  }
  return null;
});

// 已展开的分组：默认展开当前激活项所在的分组
const openGroups = ref<Set<string>>(new Set(activeGroupId.value ? [activeGroupId.value] : []));

// 激活项切换到其它分组时，自动展开其所在分组
watch(activeGroupId, (id) => {
  if (id) openGroups.value.add(id);
});

function isGroupOpen(id: string) {
  return openGroups.value.has(id);
}

function toggleGroup(id: string) {
  const next = new Set(openGroups.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  openGroups.value = next;
}

function onNav(item: NavLeaf) {
  if (!item.enabled) return;
  emit('update:activeNav', item.key);
}

async function confirmRemoveRepo(item: RepoInfo) {
  try {
    await ElMessageBox.confirm(`确定从列表中移除「${item.name}」吗？这不会删除本地仓库文件。`, '移除仓库', {
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
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="sidebar-logo">A</div>
      <span class="sidebar-brand-name">AI日报助手</span>
    </div>

    <nav class="sidebar-nav">
      <template v-for="node in navNodes" :key="isGroup(node) ? node.id : node.key">
        <!-- 分组（可折叠二级菜单） -->
        <div v-if="isGroup(node)" class="nav-group" :class="{ open: isGroupOpen(node.id) }">
          <button
            type="button"
            class="nav-group-head"
            :class="{ 'has-active': activeGroupId === node.id }"
            :aria-expanded="isGroupOpen(node.id)"
            @click="toggleGroup(node.id)"
          >
            <component :is="node.icon" :size="18" />
            <span>{{ node.label }}</span>
            <ChevronDown class="nav-group-caret" :size="16" />
          </button>
          <div v-show="isGroupOpen(node.id)" class="nav-group-body">
            <button
              v-for="child in node.children"
              :key="child.key"
              class="nav-item nav-subitem"
              :class="{ active: child.enabled && activeNav === child.key, disabled: !child.enabled }"
              @click="onNav(child)"
            >
              <component :is="child.icon" :size="16" />
              <span>{{ child.label }}</span>
            </button>
          </div>
        </div>

        <!-- 单项 -->
        <button
          v-else
          class="nav-item"
          :class="{ active: node.enabled && activeNav === node.key, disabled: !node.enabled }"
          @click="onNav(node)"
        >
          <component :is="node.icon" :size="18" />
          <span>{{ node.label }}</span>
        </button>
      </template>
    </nav>

    <div class="sidebar-projects">
      <div class="sidebar-projects-head">
        <span>仓库列表</span>
        <span v-if="sortedRepos.length" class="sidebar-projects-count">{{ sortedRepos.length }} 个</span>
        <el-button link type="primary" size="small" :icon="Plus" @click="chooseWorkspace">
          选择仓库
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

          <el-tooltip :content="isRepoPinned(item.path) ? '取消置顶' : '置顶仓库'" placement="right">
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
      <p class="sidebar-tip-desc">支持多仓库日报汇总、飞书同步与本地日志追踪</p>
      <button class="sidebar-tip-btn" @click="emit('update:activeNav', 'help')">查看帮助</button>
    </div>
  </aside>
</template>
