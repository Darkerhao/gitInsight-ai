<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Bot, ChevronDown, CircleHelp, ClipboardList, FileCog, FileText, FolderKanban, FolderOpen, History, Home, Info, MessageCircle, Settings, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
}>();

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
  { key: 'repositories', label: '仓库中心', icon: FolderOpen, enabled: true },
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
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <img class="sidebar-logo" src="../assets/logo.png" alt="Logo" />
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
