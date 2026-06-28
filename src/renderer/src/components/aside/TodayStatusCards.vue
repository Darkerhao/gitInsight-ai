<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleX, Loader, Timer } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { autoSyncRunning, dailyReports, syncLogs } = assistant;

const today = computed(() => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});

const todayReports = computed(() => dailyReports.value.filter((item) => item.date === today.value));
const todaySyncLogs = computed(() => syncLogs.value.filter((item) => item.date === today.value));

const cards = computed(() => [
  { key: 'pending', label: '待同步', value: todayReports.value.filter((item) => item.status !== 'failed').length, icon: Timer, tone: 'blue' },
  { key: 'running', label: '执行中', value: autoSyncRunning.value ? 1 : 0, icon: Loader, tone: 'green' },
  { key: 'done', label: '已完成', value: todaySyncLogs.value.filter((item) => item.status === 'success').length, icon: CircleCheck, tone: 'amber' },
  { key: 'failed', label: '失败', value: todaySyncLogs.value.filter((item) => item.status === 'failed').length, icon: CircleX, tone: 'red' },
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
    <p class="aside-card-note">基于本地数据库中今日日报和同步记录统计</p>
  </section>
</template>
