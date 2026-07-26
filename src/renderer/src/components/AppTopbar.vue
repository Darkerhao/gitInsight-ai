<script setup lang="ts">
import { computed } from 'vue';
import { CalendarDays, Command, Moon, Save, Sun } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import CheckinRewardCenter from '@/components/rewards/CheckinRewardCenter.vue';

const props = defineProps<{
  themeMode: 'light' | 'dark';
}>();

const emit = defineEmits<{
  (event: 'toggle-theme', payload: MouseEvent): void;
}>();

const assistant = useAssistant();
const { config, isConfigDirty, saveSettings } = assistant;

const reporterName = computed(() => config.reporterName || '默认用户');
const avatarText = computed(() => reporterName.value.trim().slice(0, 1) || '用');
const themeIcon = computed(() => (props.themeMode === 'dark' ? Sun : Moon));
const themeLabel = computed(() => (props.themeMode === 'dark' ? '切换浅色模式' : '切换深色模式'));
const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '午夜好';
  if (hour < 12) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const configStatusText = computed(() => (isConfigDirty.value ? '配置待保存' : '配置已同步'));
const configStatusType = computed(() => (isConfigDirty.value ? 'warning' : 'success'));
const currentDateLabel = computed(() =>
  new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date()),
);
</script>

<template>
  <header class="topbar atelier-topbar">
    <div class="topbar-command" aria-label="工作台状态栏">
      <span class="topbar-command-icon" aria-hidden="true"><Command :size="16" /></span>
      <span class="topbar-command-copy">
        <small>工作区</small>
        <strong>日报工作台</strong>
      </span>
    </div>
    <div class="topbar-greeting">
      <h1>{{ greetingText }}</h1>
      <div class="topbar-meta" aria-label="当前工作区信息">
        <span><CalendarDays :size="13" />{{ currentDateLabel }}</span>
      </div>
    </div>

    <div class="topbar-actions">
      <CheckinRewardCenter />

      <el-tooltip :content="themeLabel" placement="bottom">
        <el-button
          class="topbar-theme-btn"
          circle
          :icon="themeIcon"
          :aria-label="themeLabel"
          @click="emit('toggle-theme', $event)"
        />
      </el-tooltip>

      <el-tag class="topbar-status" :type="configStatusType" effect="plain" round>
        {{ configStatusText }}
      </el-tag>

      <el-button
        v-if="isConfigDirty"
        class="topbar-save-btn"
        type="warning"
        plain
        :icon="Save"
        @click="saveSettings"
      >
        保存配置
      </el-button>

      <div class="topbar-user">
        <el-avatar class="topbar-avatar">{{ avatarText }}</el-avatar>
        <div class="topbar-user-meta">
          <span class="topbar-user-name">{{ reporterName }}</span>
          <span class="topbar-user-caption">日报汇报人</span>
        </div>
      </div>
    </div>
  </header>
</template>
