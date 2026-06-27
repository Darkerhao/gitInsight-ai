<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleX, Loader, Timer } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { autoSyncRunning } = assistant;

// 后端暂无每日执行统计数据，此处为占位示例值；「执行中」反映真实自动同步状态。
const cards = computed(() => [
  { key: 'pending', label: '待执行', value: 2, icon: Timer, tone: 'blue' },
  { key: 'running', label: '执行中', value: autoSyncRunning.value ? 1 : 0, icon: Loader, tone: 'green' },
  { key: 'done', label: '已完成', value: 12, icon: CircleCheck, tone: 'amber' },
  { key: 'failed', label: '失败', value: 1, icon: CircleX, tone: 'red' },
]);
</script>

<template>
  <section class="aside-card">
    <div class="aside-card-head">
      <h3>今日执行状态</h3>
    </div>
    <div class="status-cards-grid">
      <div v-for="card in cards" :key="card.key" class="status-card" :class="`tone-${card.tone}`">
        <component :is="card.icon" :size="18" class="status-card-icon" />
        <strong class="status-card-value">{{ card.value }}</strong>
        <span class="status-card-label">{{ card.label }}</span>
      </div>
    </div>
    <p class="aside-card-note">统计功能开发中，当前为示例数据</p>
  </section>
</template>
