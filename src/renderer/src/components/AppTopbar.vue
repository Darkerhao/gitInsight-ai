<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, CircleHelp, MessageCircleMore } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import { useMessages } from '@/composables/useMessages';

const assistant = useAssistant();
const { config } = assistant;
const { unreadCount } = useMessages();

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
}>();

const reporterName = computed(() => config.reporterName || '默认用户');
const avatarText = computed(() => reporterName.value.slice(-2));
const greetingText = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '午夜好';
  if (hour < 12) return '上午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

function navigateToHelp() {
  emit('navigate', 'help');
}

function navigateToMessages() {
  emit('navigate', 'messages');
}

function navigateToAbout() {
  emit('navigate', 'about');
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-greeting">
      <h1>{{ greetingText }}，{{ reporterName }}</h1>
      <p>欢迎使用 AI 日报助手，智能生成、自动同步，让日报工作更简单高效。</p>
    </div>

    <div class="topbar-actions">
      <button class="topbar-pill" @click="navigateToHelp">
        <CircleHelp :size="16" />
        <span>使用帮助</span>
      </button>

      <button class="topbar-bell" @click="navigateToMessages">
        <MessageCircleMore :size="18" />
        <span v-if="unreadCount" class="topbar-badge">{{ unreadCount }}</span>
      </button>

      <el-dropdown trigger="click">
        <div class="topbar-user">
          <div class="topbar-avatar">{{ avatarText }}</div>
          <span class="topbar-user-name">{{ reporterName }}</span>
          <ChevronDown :size="14" />
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="navigateToAbout">关于我们</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>
