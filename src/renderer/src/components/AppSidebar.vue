<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import { Bot, FileCog, FileText, FolderKanban, History, Settings, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
}>();

type NavLeaf = { key: string; label: string; icon: Component; enabled: boolean };
type NavGroup = { id: string; label: string; icon: Component; children: NavLeaf[] };

const navGroups: NavGroup[] = [
  {
    id: 'report',
    label: '日报中心',
    icon: FolderKanban,
    children: [
      { key: 'generate', label: '日报生成', icon: FileText, enabled: true },
      { key: 'config', label: '日报配置', icon: FileCog, enabled: true },
      { key: 'history', label: '历史日志', icon: History, enabled: true },
    ],
  },
  {
    id: 'settings',
    label: '设置',
    icon: Settings,
    children: [{ key: 'system', label: '系统设置', icon: Settings, enabled: true }],
  },
];

const activeGroupId = computed(() => {
  for (const group of navGroups) {
    if (group.children.some((child) => child.key === props.activeNav)) {
      return group.id;
    }
  }
  return '';
});

const compactNav = ref(typeof window !== 'undefined' ? window.matchMedia('(max-width: 920px)').matches : false);
let compactNavQuery: MediaQueryList | null = null;

const menuMode = computed(() => (compactNav.value ? 'horizontal' : 'vertical'));
const menuTrigger = computed(() => (compactNav.value ? 'click' : 'hover'));
const menuDefaultOpeneds = computed(() => (compactNav.value || !activeGroupId.value ? [] : [activeGroupId.value]));
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
        <el-sub-menu v-for="group in navGroups" :key="group.id" :index="group.id" popper-class="sidebar-menu-popper">
          <template #title>
            <component :is="group.icon" :size="18" class="sidebar-menu-icon" />
            <span class="sidebar-menu-label">{{ group.label }}</span>
          </template>

          <el-menu-item v-for="child in group.children" :key="child.key" :index="child.key" :disabled="!child.enabled">
            <component :is="child.icon" :size="16" class="sidebar-menu-icon" />
            <span class="sidebar-menu-label">{{ child.label }}</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </nav>

    <div class="sidebar-tip">
      <div class="sidebar-tip-icon"><Bot :size="28" /></div>
      <div class="sidebar-tip-title">
        <Sparkles :size="14" />
        <span>简洁版提示</span>
      </div>
      <p class="sidebar-tip-desc">保留日报配置、日报生成与历史查看，聚焦你最常用的主流程。</p>
      <el-button class="sidebar-tip-btn" @click="emit('update:activeNav', 'generate')">开始生成日报</el-button>
    </div>
  </aside>
</template>
