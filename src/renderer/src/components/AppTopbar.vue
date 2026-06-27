<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Bell, ChevronDown, CircleHelp } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { config, saveSettings } = assistant;

const reporterName = computed(() => config.reporterName || '贾浩特');
const avatarText = computed(() => reporterName.value.slice(-2));

function notReady() {
  ElMessage.info('敬请期待');
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-actions">
      <button class="topbar-pill" @click="notReady">
        <CircleHelp :size="16" />
        <span>使用帮助</span>
      </button>
      <button class="topbar-bell" @click="notReady">
        <Bell :size="18" />
        <span class="topbar-badge">12</span>
      </button>
      <el-dropdown trigger="click">
        <div class="topbar-user">
          <div class="topbar-avatar">{{ avatarText }}</div>
          <span class="topbar-user-name">{{ reporterName }}</span>
          <ChevronDown :size="14" />
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
