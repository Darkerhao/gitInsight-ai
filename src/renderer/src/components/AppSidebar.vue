<script setup lang="ts">
import { ElMessage } from 'element-plus';
import { Bot, ClipboardList, FileCog, FileText, History, Home, Plus, Settings, Sparkles } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const props = defineProps<{
  activeNav: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeNav', value: string): void;
}>();

const assistant = useAssistant();
const { repos, selectedRepoPaths, toggleRepo, chooseWorkspace } = assistant;

const navItems = [
  { key: 'dashboard', label: '工作台', icon: Home, enabled: false },
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
        <el-button link type="primary" size="small" :icon="Plus" @click="chooseWorkspace">
          新建项目
        </el-button>
      </div>
      <div class="sidebar-projects-list">
        <button
          v-for="item in repos"
          :key="item.path"
          class="project-card"
          :class="{ active: selectedRepoPaths.includes(item.path) }"
          @click="toggleRepo(item.path)"
        >
          <div class="project-card-head">
            <span class="project-dot" />
            <strong>{{ item.name }}</strong>
          </div>
          <span class="project-path">{{ item.path }}</span>
        </button>
        <button v-if="!repos.length" class="project-empty" @click="chooseWorkspace">
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
