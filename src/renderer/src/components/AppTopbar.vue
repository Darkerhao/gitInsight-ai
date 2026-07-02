<script setup lang="ts">
import { computed } from 'vue';
import { Save } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, isConfigDirty, saveSettings } = assistant;

const reporterName = computed(() => config.reporterName || '默认用户');
const avatarText = computed(() => reporterName.value.slice(-2));
const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '午夜好';
  if (hour < 12) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const configStatusText = computed(() => (isConfigDirty.value ? '配置待保存' : '配置已同步'));
const configStatusType = computed(() => (isConfigDirty.value ? 'warning' : 'success'));
</script>

<template>
  <header class="topbar">
    <div class="topbar-greeting">
      <h1>{{ greetingText }}，{{ reporterName }}</h1>
      <p>当前界面已收敛为日报主流程，方便直接配置、生成与回看历史。</p>
    </div>

    <div class="topbar-actions">
      <el-tag class="topbar-status" :type="configStatusType" effect="light" round>
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
