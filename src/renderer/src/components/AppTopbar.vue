<script setup lang="ts">
import { computed } from 'vue';
import { ChevronDown, CircleHelp, MessageCircleMore, Moon, Save, Sun } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';
import { useMessages } from '@/composables/useMessages';
import CheckinRewardCenter from '@/components/rewards/CheckinRewardCenter.vue';

const props = defineProps<{
  themeMode: 'light' | 'dark';
}>();

const emit = defineEmits<{
  (e: 'navigate', value: string): void;
  (e: 'toggle-theme', payload: MouseEvent): void;
}>();

const assistant = useAssistant();
const { config, isConfigDirty, saveSettings } = assistant;
const { unreadCount } = useMessages();

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

      <el-button class="topbar-help-btn" plain :icon="CircleHelp" @click="navigateToHelp">
        使用帮助
      </el-button>

      <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99" class="topbar-message-badge">
        <el-button
          class="topbar-message-btn"
          circle
          :icon="MessageCircleMore"
          aria-label="消息"
          @click="navigateToMessages"
        />
      </el-badge>

      <el-dropdown trigger="click">
        <div class="topbar-user">
          <el-avatar class="topbar-avatar">{{ avatarText }}</el-avatar>
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
