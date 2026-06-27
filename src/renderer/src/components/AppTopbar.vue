<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Bell, CircleHelp } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, saveSettings } = assistant;

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const reporterName = computed(() => config.reporterName || '同学');
const avatarText = computed(() => reporterName.value.slice(-2));

function notReady() {
  ElMessage.info('敬请期待');
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-greeting">
      <h1>{{ greeting }}，{{ reporterName }} <span class="topbar-wave">👋</span></h1>
      <p>高效配置，智能生成，让日报工作更简单</p>
    </div>
    <div class="topbar-actions">
      <button class="topbar-pill" @click="notReady">
        <CircleHelp :size="16" />
        <span>帮助文档</span>
      </button>
      <button class="topbar-bell" @click="notReady">
        <Bell :size="18" />
        <span class="topbar-badge">12</span>
      </button>
      <el-dropdown trigger="click">
        <div class="topbar-user">
          <div class="topbar-avatar">{{ avatarText }}</div>
          <span class="topbar-user-name">{{ reporterName }}</span>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="saveSettings">保存配置</el-dropdown-item>
            <el-dropdown-item @click="notReady">关于</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>
