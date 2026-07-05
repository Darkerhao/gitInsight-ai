<script setup lang="ts">
import { computed } from 'vue';
import { CircleCheck, CircleX, Clock } from 'lucide-vue-next';
import { useAssistant } from '@/composables/useAssistant';

const assistant = useAssistant();
const { syncLogs, formatDateTime } = assistant;

const latestLogs = computed(() => syncLogs.value.slice(0, 5));
const statusMeta = {
  success: { icon: CircleCheck, title: '日报同步成功', tone: 'success' },
  failed: { icon: CircleX, title: '日报同步失败', tone: 'failed' },
  skipped: { icon: Clock, title: '日报同步已跳过', tone: 'skipped' },
  running: { icon: Clock, title: '日报同步执行中', tone: 'running' },
} as const;

function metaOf(status: string) {
  return statusMeta[status as keyof typeof statusMeta] ?? { icon: Clock, title: '日报同步记录', tone: 'running' };
}
</script>

<template>
  <section class="aside-card">
    <div class="aside-card-head">
      <h3>最近同步日志</h3>
    </div>

    <div v-if="latestLogs.length" class="sync-log-list">
      <div v-for="item in latestLogs" :key="item.id" class="sync-log-item">
        <component :is="metaOf(item.status).icon" :size="18" class="sync-log-icon" :class="`tone-${metaOf(item.status).tone}`" />
        <div class="sync-log-body">
          <strong>{{ metaOf(item.status).title }}</strong>
          <span>{{ item.message }}</span>
        </div>
        <span class="sync-log-time">{{ formatDateTime(item.ranAt) }}</span>
      </div>
    </div>
    <div v-else class="sync-log-empty">暂无同步记录</div>

    <p class="aside-card-note">记录来自本地 SQLite 同步日志</p>
  </section>
</template>
