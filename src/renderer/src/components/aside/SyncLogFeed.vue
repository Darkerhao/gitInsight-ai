<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleX, Clock } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { syncLogs, formatDateTime } = assistant;

const latestLogs = computed(() => syncLogs.value.slice(0, 5));

function iconOf(status: string) {
  if (status === 'success') return CircleCheck;
  if (status === 'failed') return CircleX;
  return Clock;
}

function titleOf(status: string) {
  if (status === 'success') return '日报同步成功';
  if (status === 'failed') return '日报同步失败';
  if (status === 'skipped') return '日报同步已跳过';
  return '日报同步记录';
}
</script>

<template>
  <section class="aside-card">
    <div class="aside-card-head">
      <h3>最近同步日志</h3>
    </div>

    <div v-if="latestLogs.length" class="sync-log-list">
      <div v-for="item in latestLogs" :key="item.id" class="sync-log-item">
        <component :is="iconOf(item.status)" :size="18" class="sync-log-icon" :class="`tone-${item.status}`" />
        <div class="sync-log-body">
          <strong>{{ titleOf(item.status) }}</strong>
          <span>{{ item.message }}</span>
        </div>
        <span class="sync-log-time">{{ formatDateTime(item.ranAt) }}</span>
      </div>
    </div>
    <div v-else class="sync-log-empty">暂无同步记录</div>

    <p class="aside-card-note">记录来自本地 SQLite 同步日志</p>
  </section>
</template>
