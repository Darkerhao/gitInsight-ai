<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import {
  Bot,
  CircleHelp,
  ClipboardList,
  FileCog,
  FileText,
  FolderKanban,
  FolderOpen,
  History,
  Home,
  Info,
  MessageCircle,
  Settings,
  Sparkles,
} from 'lucide-vue-next';

defineProps<{
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
}>();

type NavLeaf = { key: string; label: string; icon: Component; enabled: boolean };
type NavGroup = { id: string; label: string; icon: Component; children: NavLeaf[] };
type NavItem = ({ type: 'leaf' } & NavLeaf) | ({ type: 'group' } & NavGroup);

const navItems: NavItem[] = [
  { type: 'leaf', key: 'dashboard', label: '工作台', icon: Home, enabled: true },
  {
    type: 'group',
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
  { type: 'leaf', key: 'repositories', label: '仓库中心', icon: FolderOpen, enabled: true },
  { type: 'leaf', key: 'messages', label: '消息', icon: MessageCircle, enabled: true },
  {
    type: 'group',
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

const compactNav = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 920px)').matches : false);
let compactNavQuery: MediaQueryList | null = null;

const menuMode = computed(() => (compactNav.value ? 'horizontal' : 'vertical'));
const menuTrigger = computed(() => (compactNav.value ? 'click' : 'hover'));
const menuDefaultOpeneds = computed(() =>
  compactNav.value ? [] : navItems.filter((item): item is Extract<NavItem, { type: 'group' }> => item.type === 'group').map((item) => item.id),
);
const menuKey = computed(() => `${menuMode.value}:${menuDefaultOpeneds.value.join(',')}`);

function updateCompactNav() {
  compactNav.value = Boolean(compactNavQuery?.matches);
}

function onSelect(index: string) {
  emit('update:activeNav', index);
}

onMounted(() => {
  compactNavQuery = window.matchMedia('(max-width: 920px)');
  updateCompactNav();
  compactNavQuery.addEventListener('change', updateCompactNav);
});

onBeforeUnmount(() => {
  compactNavQuery?.removeEventListener('change', updateCompactNav);
});
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-brand">
      <img class="sidebar-logo" src="../assets/logo.png" alt="Logo" />
      <span class="sidebar-brand-name">AI日报助手</span>
    </div>

    <nav class="sidebar-nav" aria-label="主导航">
      <el-menu
        :key="menuKey"
        class="sidebar-menu"
        :default-active="activeNav"
        :default-openeds="menuDefaultOpeneds"
        :mode="menuMode"
        :menu-trigger="menuTrigger"
        :ellipsis="false"
        :collapse-transition="false"
        @select="onSelect"
      >
        <template v-for="item in navItems" :key="item.type === 'group' ? item.id : item.key">
          <el-sub-menu v-if="item.type === 'group'" :index="item.id" popper-class="sidebar-menu-popper">
            <template #title>
              <component :is="item.icon" :size="18" class="sidebar-menu-icon" />
              <span class="sidebar-menu-label">{{ item.label }}</span>
            </template>

            <el-menu-item v-for="child in item.children" :key="child.key" :index="child.key" :disabled="!child.enabled">
              <component :is="child.icon" :size="16" class="sidebar-menu-icon" />
              <span class="sidebar-menu-label">{{ child.label }}</span>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-else :index="item.key" :disabled="!item.enabled">
            <component :is="item.icon" :size="18" class="sidebar-menu-icon" />
            <span class="sidebar-menu-label">{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </nav>

    <div class="sidebar-tip">
      <div class="sidebar-tip-icon"><Bot :size="28" /></div>
      <div class="sidebar-tip-title">
        <Sparkles :size="14" />
        <span>AI 助手小贴士</span>
      </div>
      <p class="sidebar-tip-desc">支持多仓库日报汇总、飞书同步与本地日志追踪</p>
      <el-button class="sidebar-tip-btn" @click="emit('update:activeNav', 'help')">查看帮助</el-button>
    </div>
  </aside>
</template>
